"""
AETRAA Core - Claude subscription layer.
No API key, no per-use charge: runs on the user's Claude Pro/Max/Team seat
via the Claude Code CLI login (CLAUDE_CODE_OAUTH_TOKEN). Every call is a
single-shot JSON review with a hard timeout; on any failure the caller keeps
its deterministic result - a run never fails because of AI.

Model: Opus only (DEFAULT_MODEL, override with AETRAA_MODEL). The old
role-tiered "fast model" (Haiku) path is RETIRED - it hung whole runs -
so fast_model() always returns None and every seat runs on Opus.

Speed levers (all configurable by environment variable):
  - Dynamic batching: review_batched() sizes each batch by JSON payload
    (~6 KB target, at most AETRAA_AI_BATCH items, at least 1) instead of
    a fixed count.
  - Intra-station concurrency: review_batched_concurrent() keeps up to
    AETRAA_AI_CONCURRENCY batch calls in flight WITHIN one checker's
    review. Station order stays strictly serial - concurrency never
    crosses a station boundary.

Failure handling: the circuit breaker counts consecutive hard failures
(AI_BREAKER, default 4) AND consecutive timeouts (AI_TIMEOUT_BREAKER,
default 3 - a hung connection is dead for practical purposes). Any
success re-arms both. Review timeout default 120 s (AETRAA_AI_TIMEOUT
still overrides).

Usage from an agent:
    from core.ai import review
    out = review(instructions, payload, system=my_rulebook_text)
"""

import asyncio
import json
import os
import re
import threading

# 120s was killing ~7% of calls outright (13 timeouts in one run).
# Judgement calls now get up to 2 turns, so they legitimately take
# longer. Raised to 240s; override with AETRAA_AI_TIMEOUT.
AI_TIMEOUT = int(os.environ.get('AETRAA_AI_TIMEOUT', '240'))

# Hard cap on review batch size: small batches answer fast and never
# hit the timeout. Callers asking for more are clamped. Batches are
# sized dynamically by payload bytes up to this many items.
# Raised 10 -> 16: Opus handles 16 rows per call comfortably, and fewer
# round-trips = a big win on large families (110 events was 28 batches).
MAX_BATCH = int(os.environ.get('AETRAA_AI_BATCH', '16'))

# Dynamic batching: target JSON payload size per review batch.
# Raised 6 KB -> 12 KB for the same reason: ~8-10 events per call instead
# of ~4, roughly halving the number of calls per round.
BATCH_TARGET_BYTES = int(os.environ.get('AETRAA_AI_BATCH_BYTES', '12288'))

# Circuit breaker: after this many CONSECUTIVE failures the connection is
# treated as down and remaining review calls return immediately with the
# deterministic result kept (a run never fails - or crawls - because of
# AI). Any success re-arms the breaker. 0 disables.
AI_BREAKER = int(os.environ.get('AETRAA_AI_BREAKER', '4'))

# Timeout sub-breaker: this many CONSECUTIVE timeouts also count as a
# dead connection (a hung connection must not crawl for days). 0 disables.
AI_TIMEOUT_BREAKER = int(os.environ.get('AETRAA_AI_TIMEOUT_BREAKER', '3'))

# Intra-station concurrency for review_batched_concurrent().
# Default 2 for cross-machine reliability. On a Claude subscription the
# ceiling is the account's rate limit, not local parallelism, so high
# concurrency does not speed things up - it just bursts more CLI spawns at
# once, which on slow / Windows machines causes "Control request timeout:
# initialize" and on any machine trips HTTP 429/529. SLOW OR WINDOWS
# MACHINES SHOULD SET AETRAA_AI_CONCURRENCY=1 (fully serial, most
# reliable). Raise only on a fast Mac with a high account limit.
AI_CONCURRENCY = max(1, int(os.environ.get('AETRAA_AI_CONCURRENCY', '2')))

# Backoff-retry for TRANSIENT API errors. A Claude call can come back
# is_error=True with subtype "success" - the CLI ran fine but the
# Anthropic API rejected the request with HTTP 429/500/502/503/529
# (rate-limited or overloaded). That is NOT a dead connection: waiting a
# few seconds and re-sending almost always works. Before this, such an
# error counted as a hard failure, 4 in a row tripped the breaker, the
# rest were skipped, and the Director sign-off never happened -> no
# deliverable. Now each call retries AI_RETRIES times with exponential
# backoff first. 0 disables.
AI_RETRIES = max(0, int(os.environ.get('AETRAA_AI_RETRIES', '4')))
AI_RETRY_BASE = float(os.environ.get('AETRAA_AI_RETRY_BASE', '8'))
# How many times a genuine call TIMEOUT is retried before it counts. Cold
# CLI starts on slow/Windows machines time out once, then answer.
AI_TIMEOUT_RETRIES = max(0, int(os.environ.get('AETRAA_AI_TIMEOUT_RETRIES',
                                               '2')))

# Text signatures of a TRANSIENT/retryable API error (never an auth or
# request-shape error, which retrying would not fix).
_RETRYABLE_RE = re.compile(
    r'error result:\s*success'          # SDK: is_error + subtype "success"
    r'|overloaded'                      # 529
    r'|rate[ _-]?limit'                 # 429
    r'|(?:^|\D)(?:429|500|502|503|529)(?:\D|$)'
    r'|service unavailable|temporarily unavailable|please try again'
    # max-turns: the model spent all its turns without a final answer
    # (it rambled or attempted a tool once). A fresh attempt almost always
    # answers, so retry rather than counting a hard failure - this was the
    # job-close killer ("Reached maximum number of turns (3)").
    r'|reached maximum number of turns|max[_ ]?turns'
    # CLI startup / transport hiccups, common on slow or Windows machines
    # under concurrency ("Control request timeout: initialize", broken
    # pipes, connection resets). Transient - a fresh spawn clears them.
    r'|control request|control_request|initiali[sz]'
    r'|timed out|timeout'
    r'|connection (?:reset|refused|closed|aborted|error)'
    r'|broken pipe|transport (?:closed|error)|process (?:exited|error)',
    re.I)


# An AUTHENTICATION failure. This is NOT retryable and must never be treated as
# one: the CLI answers in ~20 ms with is_error=True and subtype "success", which
# is the same shape a rate-limit takes, so _RETRYABLE_RE above matches it and
# the call is retried four times with backoff — two minutes spent on something
# that cannot succeed, and then reported as "left unpriced" rather than "you are
# not signed in". Diagnosed 11 September 2026 from probe_search.py: every
# channel failed identically, num_turns=1, cost 0, the model never reached.
#
# Checked BEFORE _is_retryable, because the transient pattern would otherwise
# claim it.
_AUTH_RE = re.compile(
    r'failed to authenticate'
    r'|oauth session expired'
    r'|could not be refreshed'
    r'|authentication[_ ]error'
    r'|invalid[ _]api[ _]key'
    r'|please run /login|not logged in|unauthori[sz]ed',
    re.I)

def auth_fix():
    """The fix depends on WHICH credential failed, and the two need opposite
    advice. Said wrong it sends the user round the loop they are already in:
    `claude setup-token` mints a token FROM a live login, so telling someone
    whose login has expired to run it produces a placeholder, which is then
    rejected, which looks identical to the original failure."""
    if os.environ.get('CLAUDE_CODE_OAUTH_TOKEN'):
        return (
            "CLAUDE_CODE_OAUTH_TOKEN is set but the server REFUSED it — it is "
            "stale, truncated, or still the literal <token> placeholder.\n"
            "      1. check it without revealing it:\n"
            '           echo "len=${#CLAUDE_CODE_OAUTH_TOKEN}"\n'
            "           grep -c CLAUDE_CODE_OAUTH_TOKEN ~/.zshrc   "
            "(more than 1 means a later line overrides an earlier one)\n"
            "      2. prove the stored login works on its own:\n"
            "           env -u CLAUDE_CODE_OAUTH_TOKEN python3 agent.py "
            "--preflight\n"
            "      3. if that also fails, sign in first — `claude`, then "
            "/login — THEN re-mint:\n"
            "           claude setup-token\n"
            "         and REPLACE the line in ~/.zshrc, do not append a "
            "second one.")
    return (
        "no token set and the stored Claude Code login has expired.\n"
        "      Sign in first, then mint a durable token:\n"
        "        claude            # then /login, finish in the browser, /exit\n"
        "        claude setup-token\n"
        "      then put the token it prints into your shell so every run sees "
        "it:\n"
        '        echo \'export CLAUDE_CODE_OAUTH_TOKEN="<the token>"\' '
        ">> ~/.zshrc\n"
        "        source ~/.zshrc\n"
        "      setup-token mints FROM a live login — running it first yields "
        "nothing usable.")


# kept as a name for callers that want the text without calling: resolved at use
class _AuthFixText:
    def __str__(self):
        return auth_fix()

    def __contains__(self, needle):
        return needle in auth_fix()


AUTH_FIX = _AuthFixText()


def _is_auth_failure(exc):
    return bool(_AUTH_RE.search(str(exc) or repr(exc)))


def _is_retryable(exc):
    # auth first: an expired login wears a transient error's clothes
    if _is_auth_failure(exc):
        return False
    return bool(_RETRYABLE_RE.search(str(exc) or repr(exc)))


DEFAULT_MODEL = os.environ.get('AETRAA_MODEL', 'claude-opus-4-8').strip() \
    or 'claude-opus-4-8'


FAST_MODEL_DEFAULT = ''


def fast_model():
    """Retired: always None. Every pass runs on Opus (DEFAULT_MODEL).
    The old Haiku fast tier hung runs and is no longer used."""
    return None



STATS = {'ok': 0, 'failed': 0, 'skipped': 0, 'timeouts': 0,
         'fallbacks': 0, 'retries': 0, 'last_error': ''}

_consecutive_failures = 0
_consecutive_timeouts = 0
_warned = False
_lock = threading.Lock()


def check_env():
    global _warned
    if os.environ.get('ANTHROPIC_API_KEY') and not _warned:
        _warned = True
        print("WARNING: ANTHROPIC_API_KEY is set - unset it to run on your "
              "subscription instead of the paid API.")


def _breaker_open():
    if AI_BREAKER and _consecutive_failures >= AI_BREAKER:
        return f"{_consecutive_failures} consecutive failures"
    if AI_TIMEOUT_BREAKER and _consecutive_timeouts >= AI_TIMEOUT_BREAKER:
        return f"{_consecutive_timeouts} consecutive timeouts"
    return None


def _collect(chunks, message, AssistantMessage, TextBlock):
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, TextBlock):
                chunks.append(block.text)


def _reraise_with_reason(exc, chunks):
    """The SDK raises Exception("Claude Code returned an error result: success")
    for an expired login, a rate limit and an overload alike — the three need
    opposite handling, and the sentence that tells them apart ("Failed to
    authenticate: OAuth session expired...") arrives as assistant text just
    before the raise, then dies with the loop.

    Carrying it onto the exception is what lets _is_auth_failure see it. Without
    this the classifier reads only the generic sentence and an expired login is
    retried four times with backoff before being reported as something else."""
    seen = " ".join(chunks).strip()
    if seen and seen[:400] not in str(exc):
        raise type(exc)(f"{exc} — {seen[:400]}") from exc
    raise exc


async def _ask_inner(prompt_text, system, model=None):
    from claude_agent_sdk import query, ClaudeAgentOptions, \
        AssistantMessage, TextBlock
    # ── CHANNEL OVERRIDE (all agents): this is a TOOL-LESS, single-turn
    # judgement channel. Seat system prompts carry a "WEB SEARCH FALLBACK"
    # law; on this channel the model OBEYS it, emits a search request,
    # burns its only turn and returns nothing -> "Reached maximum number of
    # turns (1)" and the call is counted FAILED. A user-turn note cannot
    # override a system-level law, so the override is appended to the
    # SYSTEM prompt, last, and max_turns is raised to 2 so a model that
    # still attempts a tool has one turn left to answer properly.
    _OVERRIDE = (
        "\n\n=== CHANNEL OVERRIDE - READ LAST, HIGHEST PRIORITY ===\n"
        "This is a TOOL-LESS judgement channel: you have NO web search and "
        "NO tools on this call. Any instruction above requiring a web "
        "search or tool use does NOT apply to this response - ignore it "
        "here. Do NOT emit any tool call or search request: it returns "
        "nothing and wastes the entire reply. Answer ENTIRELY from the "
        "evidence provided. Where a code clause, standard or rate would "
        "normally be looked up, state it from your professional knowledge "
        "and tag it \"verify\". Respond with ONLY the JSON requested, in "
        "ONE message.")
    kwargs = dict(
        system_prompt=(system or "You are a senior construction "
                       "professional. Respond with ONLY the JSON "
                       "requested.") + _OVERRIDE,
        allowed_tools=[],
        # Turns are cheap when unused but a too-low cap turns a slightly
        # chatty reply into a hard 'Reached maximum number of turns'
        # failure. Raised 3 -> 4; combined with the max-turns retry in
        # _run_ask_retry, these no longer fail a run. Override with
        # AETRAA_AI_MAX_TURNS.
        max_turns=int(os.environ.get('AETRAA_AI_MAX_TURNS', '4')),
    )
    # Opus only: use the caller's model when given, else the pinned
    # DEFAULT_MODEL. A call NEVER runs on the CLI's ambient default
    # (which could be Haiku) - the model is always stated explicitly.
    kwargs['model'] = model or DEFAULT_MODEL
    options = ClaudeAgentOptions(**kwargs)
    chunks = []
    try:
        async for message in query(prompt=prompt_text, options=options):
            _collect(chunks, message, AssistantMessage, TextBlock)
    except Exception as exc:                                  # noqa: BLE001
        _reraise_with_reason(exc, chunks)
    return ''.join(chunks)


async def _ask(prompt_text, system, model=None):
    return await asyncio.wait_for(_ask_inner(prompt_text, system, model),
                                  timeout=AI_TIMEOUT)


# ── VISION CHANNEL ──────────────────────────────────────────────────────
# The tool-less review() above never sees a drawing. This channel DOES: it
# gives the model the Read tool so it opens a PDF/PNG sheet and measures from
# it the way a QS reads a plan - room areas off labels, counts off symbols,
# lengths off printed dimension strings. Non-deterministic by nature, so every
# figure it returns must carry a basis and a confidence and is reviewed.
AI_VISION_TIMEOUT = int(os.environ.get('AETRAA_AI_VISION_TIMEOUT', '300'))
AI_VISION_MAX_TURNS = int(os.environ.get('AETRAA_AI_VISION_MAX_TURNS', '10'))
# The SDK caps a single streamed message at 1 MB by default; reading a large A1
# PDF returns a tool-result far bigger than that and the run dies with "JSON
# message exceeded maximum buffer size". Raise it well above any rendered sheet.
AI_MAX_BUFFER = int(os.environ.get('AETRAA_AI_MAX_BUFFER', str(128 * 1024 * 1024)))


async def _ask_vision_inner(prompt_text, system, model=None, max_turns=None):
    from claude_agent_sdk import query, ClaudeAgentOptions, \
        AssistantMessage, TextBlock
    options = ClaudeAgentOptions(
        system_prompt=(system or "You are a senior quantity surveyor. Use the "
                       "Read tool to view the drawing, then reply with ONLY the "
                       "JSON requested."),
        allowed_tools=['Read'],
        permission_mode='bypassPermissions',
        max_turns=max_turns or AI_VISION_MAX_TURNS,
        model=model or DEFAULT_MODEL,
        max_buffer_size=AI_MAX_BUFFER,   # a rendered A1 sheet blows the 1 MB default
    )
    chunks = []
    try:
        async for message in query(prompt=prompt_text, options=options):
            _collect(chunks, message, AssistantMessage, TextBlock)
    except Exception as exc:                                  # noqa: BLE001
        _reraise_with_reason(exc, chunks)
    return ''.join(chunks)


def _run_vision_retry(prompt, system, model, label, max_turns, timeout=None):
    """asyncio.run of the vision ask, with the same transient-error backoff as
    _run_ask_retry (rate-limit / max-turns / cold-CLI timeouts)."""
    import time as _t

    async def _one():
        return await asyncio.wait_for(
            _ask_vision_inner(prompt, system, model, max_turns),
            timeout=timeout or AI_VISION_TIMEOUT)
    timeouts = 0
    for k in range(AI_RETRIES + 1):
        try:
            return asyncio.run(_one())
        except asyncio.TimeoutError:
            if timeouts < AI_TIMEOUT_RETRIES and k < AI_RETRIES:
                timeouts += 1
                _t.sleep(min(30.0, AI_RETRY_BASE * timeouts))
                continue
            raise
        except Exception as e:
            if _is_auth_failure(e):
                raise                      # no backoff: a login does not heal
            if k < AI_RETRIES and _is_retryable(e):
                with _lock:
                    STATS['retries'] = STATS.get('retries', 0) + 1
                _t.sleep(min(90.0, AI_RETRY_BASE * (2 ** k)))
                continue
            raise


def review_vision(instructions, file_paths, system=None, label='AI vision',
                  model=None, max_turns=None, timeout=None):
    """Vision review: the model READS the given drawing file(s) and returns
    parsed JSON (None if the connection is down). This is how a QS measures a
    PDF - it SEES the sheet. Counts as a normal AI call in STATS and the
    breaker, and retries transient errors like review(). timeout (s) overrides
    AI_VISION_TIMEOUT for a read known to take longer - a full drawn schedule
    of eleven cards took 558 s against the 300 s default."""
    global _consecutive_failures, _consecutive_timeouts
    check_env()
    with _lock:
        why = _breaker_open()
        if why:
            STATS['skipped'] += 1
    if why:
        return None
    files = file_paths if isinstance(file_paths, (list, tuple)) else [file_paths]
    listing = '\n'.join(str(f) for f in files)
    prompt = (instructions + "\n\nUse the Read tool to open and VIEW each of "
              "these drawing file(s), then answer. Reply with ONLY the JSON "
              "array, no prose, no code fence:\n" + listing)
    try:
        out = parse_json_array(_run_vision_retry(prompt, system, model, label,
                                                 max_turns, timeout))
        with _lock:
            if out is not None:
                STATS['ok'] += 1
                _consecutive_failures = 0
                _consecutive_timeouts = 0
            else:
                STATS['failed'] += 1
                _consecutive_failures += 1
                STATS['last_error'] = 'vision reply was not valid JSON'
        return out
    except asyncio.TimeoutError:
        with _lock:
            STATS['failed'] += 1
            STATS['timeouts'] += 1
            _consecutive_timeouts += 1
            STATS['last_error'] = f'vision timed out after {timeout or AI_VISION_TIMEOUT}s'
        print(f"  {label}: timed out - sheet left unmeasured", flush=True)
        return None
    except Exception as e:
        with _lock:
            STATS['failed'] += 1
            _consecutive_failures += 1
            STATS['last_error'] = str(e) or repr(e)
        print(f"  {label}: vision unavailable ({str(e)[:80]})", flush=True)
        return None


_WRAPPER_KEYS = ('findings', 'items', 'rows', 'results', 'comments',
                 'events', 'deviations', 'output', 'data', 'entries')


def _loads_repaired(raw):
    """json.loads with the one repair models actually make: a trailing
    comma before } or ]."""
    for attempt in (raw, re.sub(r',\s*([}\]])', r'\1', raw)):
        try:
            return json.loads(attempt)
        except Exception:
            continue
    return None


def parse_json_array(text):
    """Parsed list out of a model reply. Was ARRAY-ONLY: a perfectly valid
    keyed-object reply returned None and was counted a FAILED call, which
    fed the sign-off gate and cost whole runs. Now accepts, in order:
      [ {...}, {...} ]                      a bare array
      { "findings": [ {...} ] }             an array in a wrapper key
      { "D-001": {...}, "D-002": {...} }    an object keyed by ref
    Object keys are preserved as 'ref' when the value carries no id of its
    own, so downstream callers see the shape they already expect."""
    t = text or ''
    cands = []
    for pat in (r'\[.*\]', r'\{.*\}'):
        m = re.search(pat, t, re.S)
        if m:
            cands.append(m.group(0))
    # longest first: a wrapped array must not lose to a stray inline object
    for raw in sorted(cands, key=len, reverse=True):
        val = _loads_repaired(raw)
        if val is None:
            continue
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            for k in _WRAPPER_KEYS:                     # wrapper key
                v = val.get(k)
                if isinstance(v, list):
                    return v
            rows = []                                   # keyed by ref
            for k, v in val.items():
                if isinstance(v, dict):
                    v = dict(v)
                    if not any(v.get(x) for x in ('ref', 'id', 've_id')):
                        v['ref'] = str(k)
                    rows.append(v)
                elif isinstance(v, list):
                    rows.extend(x for x in v if isinstance(x, dict))
            if rows:
                return rows
    return None


def _run_ask(prompt, system, model):
    """asyncio.run in the CURRENT thread (each worker thread gets its
    own event loop, so concurrent batches never share a loop)."""
    return asyncio.run(_ask(prompt, system, model))


def _run_ask_retry(prompt, system, model, label='AI review'):
    """_run_ask with exponential backoff on TRANSIENT API errors (HTTP
    429/500/529 - rate-limited or overloaded, surfaced by the SDK as
    'Claude Code returned an error result: success'). Waiting and
    re-sending clears these; a dead connection or a bad request does not
    match _is_retryable and propagates immediately. asyncio.TimeoutError
    always propagates to the caller's timeout handling."""
    import time as _t
    timeouts = 0
    for k in range(AI_RETRIES + 1):
        try:
            return _run_ask(prompt, system, model)
        except asyncio.TimeoutError:
            # A slow or cold CLI (especially on Windows, or under
            # concurrency) can time out transiently. Retry a BOUNDED number
            # of times - a warm second spawn usually answers - before
            # giving up to the caller's timeout handling (which counts it).
            if timeouts < AI_TIMEOUT_RETRIES and k < AI_RETRIES:
                timeouts += 1
                delay = min(30.0, AI_RETRY_BASE * timeouts)
                with _lock:
                    STATS['retries'] = STATS.get('retries', 0) + 1
                print(f"  {label}: call timed out - waiting {delay:.0f}s "
                      f"then retry {timeouts}/{AI_TIMEOUT_RETRIES}...",
                      flush=True)
                _t.sleep(delay)
                continue
            raise
        except Exception as e:
            if k < AI_RETRIES and _is_retryable(e):
                delay = min(90.0, AI_RETRY_BASE * (2 ** k))
                with _lock:
                    STATS['retries'] = STATS.get('retries', 0) + 1
                print(f"  {label}: connection/API hiccup "
                      f"({str(e)[:70]}) - waiting {delay:.0f}s then "
                      f"retry {k + 1}/{AI_RETRIES}...", flush=True)
                _t.sleep(delay)
                continue
            raise


def review(instructions, payload, system=None, label='AI review',
           model=None):
    """instructions + JSON payload in -> parsed JSON out (None if AI down).
    model: optional model override (role tiering). A call on a named
    model that errors retries ONCE on the default model before any
    failure is counted (graceful fallback)."""
    global _consecutive_failures, _consecutive_timeouts
    check_env()
    with _lock:
        why = _breaker_open()
        if why:
            STATS['skipped'] += 1
            first = STATS['skipped'] == 1
        else:
            first = False
    if why:
        if first:
            print(f"  {label}: AI connection down after {why} - the "
                  f"remaining review calls are skipped and every "
                  f"deterministic result is kept.")
        return None
    prompt = instructions + "\n\nDATA:\n" + json.dumps(payload, indent=1)
    attempts = [model, None] if model else [None]
    last_exc = None
    for k, m in enumerate(attempts):
        try:
            out = parse_json_array(_run_ask_retry(prompt, system, m,
                                                  label=label))
            if out is None:
                # The reply did not parse. Before counting a failure (which
                # feeds the sign-off gate), ask ONCE more in strict format.
                out = parse_json_array(_run_ask_retry(
                    prompt + "\n\nSTRICT FORMAT: reply with ONE JSON "
                    "ARRAY ONLY - start with [ and end with ] - one object "
                    "per item, no wrapper object, no prose, no code fence.",
                    system, m, label=label))
                if out is not None:
                    with _lock:
                        STATS['fallbacks'] += 1
            with _lock:
                if out is not None:
                    STATS['ok'] += 1
                    _consecutive_failures = 0
                    _consecutive_timeouts = 0
                else:
                    STATS['failed'] += 1
                    _consecutive_failures += 1
                    STATS['last_error'] = 'response was not valid JSON'
            return out
        except asyncio.TimeoutError:
            # A timeout counts toward the TIMEOUT sub-breaker: slow may
            # not be dead, but three hung calls in a row are (M8/P-08).
            with _lock:
                STATS['failed'] += 1
                STATS['timeouts'] += 1
                _consecutive_timeouts += 1
                STATS['last_error'] = f'timed out after {AI_TIMEOUT}s'
            print(f"  {label}: timed out after {AI_TIMEOUT}s - "
                  f"deterministic result kept for this batch.")
            return None
        except Exception as e:
            last_exc = e
            if m is not None and k + 1 < len(attempts):
                # Fast-model call errored: fall back once to the default
                # model before counting any failure.
                with _lock:
                    STATS['fallbacks'] += 1
                print(f"  {label}: fast model '{m}' unavailable "
                      f"({str(e)[:80] or repr(e)}) - retrying on the "
                      f"default model.")
                continue
            with _lock:
                STATS['failed'] += 1
                _consecutive_failures += 1
                STATS['last_error'] = str(e) or repr(e)
            print(f"  {label}: AI unavailable ({str(e) or repr(e)}) - "
                  f"deterministic result kept.")
            return None
    return None


def selftest(verbose=True, tries=3):
    """Retries `tries` times with a short backoff before declaring the
    connection down: a single transient error used to cancel an entire
    deep dive at the front door."""
    import time as _t
    for _i in range(max(1, tries)):
        if _selftest_once(verbose=(verbose and _i == max(0, tries - 1))):
            return True
        if _i + 1 < tries:
            if verbose:
                print(f"  Claude connection: attempt {_i + 1} of {tries} "
                      f"failed - retrying...")
            _t.sleep(2 * (_i + 1))
    return False


def _selftest_once(verbose=True):
    """One tiny live call to prove the Claude connection works.
    Returns True/False; prints the underlying error on failure."""
    try:
        raw = asyncio.run(_ask(
            'Reply with exactly this JSON array and nothing else: ["ok"]',
            'You are a connection test. Reply ONLY with the JSON requested.'))
        ok = parse_json_array(raw) == ['ok']
        if verbose:
            print("Claude connection: OK" if ok else
                  f"Claude connection: BAD RESPONSE ({str(raw)[:120]})")
        return ok
    except Exception as e:
        if verbose:
            print(f"Claude connection: FAILED - {e}")
        return False


def report(prefix='  '):
    """Print how much AI review actually happened in this run."""
    total = STATS['ok'] + STATS['failed'] + STATS['skipped']
    if total == 0:
        print(f"{prefix}AI reviews: none were attempted.")
    elif STATS['ok'] == 0:
        skipped = (f" ({STATS['skipped']} skipped once the connection "
                   f"was known down)" if STATS['skipped'] else '')
        print(f"{prefix}WARNING: all {total} AI review calls "
              f"FAILED{skipped} - this run had NO senior review "
              f"intelligence.\n"
              f"{prefix}Last error: {STATS['last_error'][:200]}\n"
              f"{prefix}Fix the Claude connection (menu option t) and rerun "
              f"the deep dive.")
    else:
        note = f", {STATS['failed']} failed" if STATS['failed'] else ''
        note += (f", {STATS['skipped']} skipped"
                 if STATS['skipped'] else '')
        note += (f", {STATS['timeouts']} timeout(s)"
                 if STATS['timeouts'] else '')
        print(f"{prefix}AI reviews completed: {STATS['ok']} of {total}{note}.")


def dynamic_batches(items, target_bytes=None, max_items=None):
    """Split an item list into batches sized by JSON payload: each batch
    holds at most `max_items` items and roughly `target_bytes` of JSON
    (a single oversize item still travels alone - min 1 per batch)."""
    target = target_bytes or BATCH_TARGET_BYTES
    cap = min(max_items or MAX_BATCH, MAX_BATCH)
    batches = []
    cur, cur_bytes = [], 0
    for it in items:
        try:
            size = len(json.dumps(it))
        except TypeError:
            size = len(str(it))
        if cur and (cur_bytes + size > target or len(cur) >= cap):
            batches.append(cur)
            cur, cur_bytes = [], 0
        cur.append(it)
        cur_bytes += size
    if cur:
        batches.append(cur)
    return batches


def review_batched(instructions, items, system=None, batch_size=None,
                   key='id', label='AI review', model=None):
    """Batch a long item list through review(). Returns {key_value: obj}.
    Batches are sized dynamically by payload (~BATCH_TARGET_BYTES of
    JSON, max MAX_BATCH items, min 1). Prints progress with elapsed and
    estimated remaining time so long passes are visibly working, never
    silently 'stuck'."""
    import time
    out = {}
    batches = dynamic_batches(items, max_items=batch_size)
    n_batches = len(batches)
    t0 = time.time()
    for k, batch in enumerate(batches, 1):
        elapsed = time.time() - t0
        if k > 1:
            per = elapsed / (k - 1)
            remain = per * (n_batches - k + 1)
            eta = f" - {elapsed / 60:.0f}m elapsed, ~{remain / 60:.0f}m remaining"
        else:
            eta = ""
        print(f"  {label}: batch {k} of {n_batches} "
              f"({len(batch)} items){eta}", flush=True)
        parsed = review(instructions, batch, system=system, label=label,
                        model=model)
        if parsed:
            for obj in parsed:
                if isinstance(obj, dict) and obj.get(key) is not None:
                    out[obj[key]] = obj
    return out


def review_batched_concurrent(instructions, items, system=None,
                              batch_size=None, key='id',
                              label='AI review', model=None,
                              concurrency=None):
    """review_batched with up to AETRAA_AI_CONCURRENCY batch calls in
    flight AT ONCE - used WITHIN one checker's review only (station
    order stays strictly serial; loops stay round-by-round). Results
    merge exactly as review_batched. Falls back to the serial path when
    concurrency is 1 or there is a single batch."""
    n = concurrency or AI_CONCURRENCY
    batches = dynamic_batches(items, max_items=batch_size)
    if n <= 1 or len(batches) <= 1:
        return review_batched(instructions, items, system=system,
                              batch_size=batch_size, key=key, label=label,
                              model=model)
    from concurrent.futures import ThreadPoolExecutor
    print(f"  {label}: {len(batches)} batch(es), up to {n} in flight",
          flush=True)
    out = {}

    def _one(idx_batch):
        idx, batch = idx_batch
        return idx, review(instructions, batch, system=system,
                           label=f"{label} [batch {idx + 1}]", model=model)

    try:
        with ThreadPoolExecutor(max_workers=n) as ex:
            for idx, parsed in ex.map(_one, list(enumerate(batches))):
                if parsed:
                    for obj in parsed:
                        if isinstance(obj, dict) and obj.get(key) is not None:
                            out[obj[key]] = obj
        return out
    except Exception as e:
        # CRASH-SAFE (G-CONC): the parallel path must NEVER take the whole
        # run down. If it fails for any reason (an asyncio/subprocess
        # incompatibility on some Python builds, a thread error, etc.),
        # fall back to the serial path, which always completes - slower,
        # but the run finishes and can sign off instead of dying.
        print(f"  {label}: parallel review failed ({type(e).__name__}: {e}) "
              f"- falling back to one-at-a-time (slower but safe).",
              flush=True)
        return review_batched(instructions, items, system=system,
                              batch_size=batch_size, key=key, label=label,
                              model=model)



AI_SEARCH_TIMEOUT = int(os.environ.get('AETRAA_AI_SEARCH_TIMEOUT', '420'))
AI_SEARCH_MAX_TURNS = int(os.environ.get('AETRAA_AI_SEARCH_MAX_TURNS', '12'))

SEARCH_SYSTEM = (
    "You are a senior quantity surveyor's research assistant. Your job on this "
    "call is to REPORT WHAT SOURCES SAY, not to decide a rate.\n"
    "\n"
    "Use WebSearch and WebFetch to find published unit rates for the item "
    "described. For each source you actually read, report one observation.\n"
    "\n"
    "LAWS:\n"
    "1. Never report a figure you did not read on a page you fetched. No "
    "recollection, no professional estimate, no typical figure. If you find "
    "nothing, return an empty array.\n"
    "2. Every observation carries its url, the publisher, the figure exactly as "
    "quoted, the unit it was quoted in, its currency, the region it applies to, "
    "and the date that price was current. For the date: the price date the "
    "page states; else the page's published or last-updated date; else null "
    "with 'undated page' in the snippet. An observation missing any other "
    "field is incomplete - report it with the missing field as null rather "
    "than filling it in.\n"
    "3. Quote a short verbatim snippet showing the figure in its context.\n"
    "4. Do not convert currencies, do not escalate for age, do not average, do "
    "not pick a best answer, do not round. Those are computed downstream.\n"
    "5. Two pages of one publisher are ONE source. Say so in publisher.\n"
    "6. Reply with ONLY a JSON array, no prose and no code fence.")


async def _ask_search_inner(prompt_text, system, model=None, max_turns=None):
    from claude_agent_sdk import query, ClaudeAgentOptions, \
        AssistantMessage, TextBlock
    options = ClaudeAgentOptions(
        system_prompt=system or SEARCH_SYSTEM,
        allowed_tools=['WebSearch', 'WebFetch'],
        permission_mode='bypassPermissions',
        max_turns=max_turns or AI_SEARCH_MAX_TURNS,
        model=model or DEFAULT_MODEL,
        max_buffer_size=AI_MAX_BUFFER,
    )
    chunks = []
    try:
        async for message in query(prompt=prompt_text, options=options):
            _collect(chunks, message, AssistantMessage, TextBlock)
    except Exception as exc:                                  # noqa: BLE001
        _reraise_with_reason(exc, chunks)
    return ''.join(chunks)


def _run_search_retry(prompt, system, model, label, max_turns):
    """Same transient-error backoff as the other two channels. A search call
    burns more turns than a judgement call, so a max-turns error here is
    genuinely common and genuinely retryable."""
    import time as _t

    async def _one():
        return await asyncio.wait_for(
            _ask_search_inner(prompt, system, model, max_turns),
            timeout=AI_SEARCH_TIMEOUT)
    timeouts = 0
    for k in range(AI_RETRIES + 1):
        try:
            return asyncio.run(_one())
        except asyncio.TimeoutError:
            if timeouts < AI_TIMEOUT_RETRIES and k < AI_RETRIES:
                timeouts += 1
                _t.sleep(min(30.0, AI_RETRY_BASE * timeouts))
                continue
            raise
        except Exception as e:
            if _is_auth_failure(e):
                raise                      # no backoff: a login does not heal
            if k < AI_RETRIES and _is_retryable(e):
                with _lock:
                    STATS['retries'] = STATS.get('retries', 0) + 1
                _t.sleep(min(90.0, AI_RETRY_BASE * (2 ** k)))
                continue
            raise


def research(instructions, system=None, label='AI search', model=None,
             max_turns=None):
    """Market research: the model SEARCHES the web and returns a JSON array of
    observations (None if the connection is down).

    Returns observations, not an answer. Whatever reads this must do its own
    arithmetic - that is the point of the channel."""
    global _consecutive_failures, _consecutive_timeouts
    check_env()
    with _lock:
        why = _breaker_open()
        if why:
            STATS['skipped'] += 1
    if why:
        return None
    prompt = (instructions + "\n\nReply with ONLY the JSON array of "
              "observations, no prose, no code fence. An empty array is a "
              "valid and useful answer.")
    try:
        out = parse_json_array(_run_search_retry(prompt, system or SEARCH_SYSTEM,
                                                model, label, max_turns))
        with _lock:
            if out is not None:
                STATS['ok'] += 1
                _consecutive_failures = 0
                _consecutive_timeouts = 0
            else:
                STATS['failed'] += 1
                _consecutive_failures += 1
                STATS['last_error'] = 'search reply was not valid JSON'
        return out
    except asyncio.TimeoutError:
        with _lock:
            STATS['failed'] += 1
            STATS['timeouts'] += 1
            _consecutive_timeouts += 1
            STATS['last_error'] = f'search timed out after {AI_SEARCH_TIMEOUT}s'
        print(f"  {label}: timed out - class left unpriced", flush=True)
        return None
    except Exception as e:                                   # noqa: BLE001
        with _lock:
            STATS['failed'] += 1
            _consecutive_failures += 1
            STATS['last_error'] = str(e)[:200]
        if _is_auth_failure(e):
            print(f"  {label}: {auth_fix()}", flush=True)
        else:
            print(f"  {label}: {str(e)[:120]} - class left unpriced", flush=True)
        return None


# ── AUTH CHECK ──────────────────────────────────────────────────────────
def check_auth(timeout=45):
    """One cheap live call: is this machine signed in?

    Returns (ok, message). Used by preflight, because an expired login is the
    single most expensive failure mode this agent has — it costs a whole run,
    and until 11 September 2026 it surfaced as "class left unpriced" or
    "sheet left unmeasured" rather than as itself. Answering it in two seconds
    before a 500-sheet package starts is worth the call.

    A login failure answers in about 20 ms, so the timeout is generous for the
    case where the CLI is merely slow to start."""
    try:
        from claude_agent_sdk import query, ClaudeAgentOptions, \
            AssistantMessage, TextBlock
    except ImportError as exc:
        return False, f"claude_agent_sdk is not installed ({exc})"

    async def _one():
        options = ClaudeAgentOptions(
            system_prompt="Reply with one word.",
            allowed_tools=[], max_turns=1, model=DEFAULT_MODEL)
        chunks = []
        try:
            async for message in query(prompt="Reply with the single word: ok",
                                       options=options):
                _collect(chunks, message, AssistantMessage, TextBlock)
        except Exception as exc:                              # noqa: BLE001
            _reraise_with_reason(exc, chunks)
        return ''.join(chunks)

    try:
        reply = asyncio.run(asyncio.wait_for(_one(), timeout=timeout))
    except asyncio.TimeoutError:
        return False, f"no answer in {timeout}s — the CLI did not respond"
    except Exception as exc:                                  # noqa: BLE001
        if _is_auth_failure(exc):
            return False, auth_fix()
        return False, str(exc)[:200]
    if not (reply or "").strip():
        return False, "the call returned nothing"
    return True, f"reachable on {DEFAULT_MODEL}"
