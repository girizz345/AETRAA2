#!/usr/bin/env python3
"""
probe_search.py — why the search channel came back "error result: success".

TEMPORARY DIAGNOSTIC. Delete it once the answer is known.

core/ai.py keeps only the assistant TEXT blocks and throws the rest away, which
is right for a run and useless for a failure: the reason a call failed lives in
the ResultMessage the SDK sends last, and in the init system message that lists
which tools the CLI actually accepted. This prints all of it.

Four probes, narrowing:
  1  no tools, trivial prompt      — is the channel alive at all?
  2  no tools, custom system       — does replacing the system prompt break it?
  3  WebSearch only                — is that tool accepted on this seat?
  4  WebSearch + WebFetch          — the combination the agent actually uses

  python3 probe_search.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# the same model every other channel in this agent uses, so the probe tests the
# agent's own configuration rather than a model of its own choosing
from core.ai import DEFAULT_MODEL as MODEL


def dump(tag, message):
    kind = type(message).__name__
    bits = [f"    [{kind}]"]
    for field in ("subtype", "is_error", "duration_ms", "num_turns",
                  "total_cost_usd", "session_id", "result", "data"):
        if hasattr(message, field):
            value = getattr(message, field)
            if value is None:
                continue
            text = str(value)
            if field == "data" and isinstance(value, dict):
                # the init message lists the tools the CLI accepted
                keep = {k: value[k] for k in ("tools", "model", "permissionMode",
                                              "slash_commands")
                        if k in value}
                text = str(keep)
            bits.append(f"      {field} = {text[:600]}")
    content = getattr(message, "content", None)
    if content:
        for block in content:
            name = type(block).__name__
            if hasattr(block, "text"):
                bits.append(f"      {name}: {block.text[:300]}")
            elif hasattr(block, "name"):
                bits.append(f"      {name}: tool={block.name} "
                            f"input={str(getattr(block, 'input', ''))[:160]}")
            else:
                bits.append(f"      {name}: {str(block)[:200]}")
    print("\n".join(bits), flush=True)


async def probe(label, prompt, system=None, tools=None, max_turns=3,
                permission=None):
    from claude_agent_sdk import query, ClaudeAgentOptions
    print(f"\n{'=' * 70}\n{label}\n  tools      = {tools}\n"
          f"  system     = {'custom' if system else '(default)'}\n"
          f"  max_turns  = {max_turns}\n  permission = {permission}\n"
          f"{'-' * 70}", flush=True)
    kwargs = dict(max_turns=max_turns, model=MODEL)
    if system:
        kwargs["system_prompt"] = system
    if tools is not None:
        kwargs["allowed_tools"] = tools
    if permission:
        kwargs["permission_mode"] = permission
    try:
        options = ClaudeAgentOptions(**kwargs)
    except TypeError as exc:
        print(f"    ClaudeAgentOptions rejected these kwargs: {exc}")
        return
    # wait_for takes a COROUTINE, not an async generator — wrap the iteration
    # in one rather than trying to time out the generator itself.
    async def collect():
        async for message in query(prompt=prompt, options=options):
            dump("", message)

    try:
        await asyncio.wait_for(collect(), timeout=240)
    except asyncio.TimeoutError:
        print("    TIMED OUT after 240s")
    except Exception as exc:                                   # noqa: BLE001
        import traceback
        print(f"    RAISED {type(exc).__name__}: {str(exc)[:500]}")
        print("      " + traceback.format_exc()[-700:].replace("\n", "\n      "))


async def main():
    try:
        import claude_agent_sdk as sdk
    except ImportError as exc:
        print(f"claude_agent_sdk not importable: {exc}")
        return 2
    print(f"claude_agent_sdk {getattr(sdk, '__version__', 'version unknown')}")
    print(f"python {sys.version.split()[0]}")
    print(f"CLAUDE_CODE_OAUTH_TOKEN "
          f"{'set' if os.environ.get('CLAUDE_CODE_OAUTH_TOKEN') else 'NOT set'}")
    print(f"ANTHROPIC_API_KEY "
          f"{'SET — this would bill the API' if os.environ.get('ANTHROPIC_API_KEY') else 'not set (correct)'}")
    print(f"model {MODEL}")

    await probe("1. no tools, trivial prompt",
                "Reply with the single word: alive")

    await probe("2. no tools, replaced system prompt",
                "Reply with ONLY this JSON array: [{\"ok\":true}]",
                system="You are a research assistant. Reply with ONLY JSON.")

    await probe("3. WebSearch only",
                "Search the web for the current price of Portland cement in "
                "the UAE. Report one line: the figure and the url you read it "
                "on.",
                tools=["WebSearch"], max_turns=6,
                permission="bypassPermissions")

    await probe("4. WebSearch + WebFetch (what the agent uses)",
                "Search the web for a published unit rate for bulk excavation "
                "in Dubai, per cubic metre. Read one page and report the "
                "figure and its url.",
                tools=["WebSearch", "WebFetch"], max_turns=8,
                permission="bypassPermissions")

    print(f"\n{'=' * 70}\nRead probe 1 first: if it fails, the problem is the "
          f"channel, not the tools.\nIf 1 and 2 pass and 3 fails, the tool is "
          f"the problem.\n{'=' * 70}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()) or 0)
