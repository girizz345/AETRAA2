"""Why a run said "class left unpriced" when it meant "you are not signed in".

Diagnosed 11 September 2026. Every channel failed in ~20 ms with num_turns=1 and
zero cost. The SDK raises one generic sentence for three different causes:

    Exception: Claude Code returned an error result: success

An expired login, a 429 and a 529 all arrive wearing it. Two of the three should
be retried with backoff; the third can never succeed, and retrying it spends two
minutes before reporting the wrong thing. The sentence that tells them apart —
"Failed to authenticate: OAuth session expired and could not be refreshed" —
arrives as assistant text just before the raise and used to die with the loop.

These tests hold both halves in place: the text is carried onto the exception,
and an auth failure is never classified as transient.
"""
import re
import types

import pytest

import core.ai as ai

GENERIC = "Claude Code returned an error result: success"
AUTH_TEXT = ("Failed to authenticate: OAuth session expired and could not be "
             "refreshed")


def test_the_generic_sentence_alone_is_still_transient():
    """A 429 and an overload wear it too, and those DO deserve a retry."""
    assert ai._is_retryable(Exception(GENERIC))
    assert not ai._is_auth_failure(Exception(GENERIC))


def test_an_auth_failure_is_never_retryable():
    exc = Exception(f"{GENERIC} — {AUTH_TEXT}")
    assert ai._is_auth_failure(exc)
    assert not ai._is_retryable(exc), "an expired login was queued for backoff"


def test_the_reason_is_carried_onto_the_generic_exception():
    """This is the half that makes the classifier able to see anything at all."""
    with pytest.raises(Exception) as caught:
        ai._reraise_with_reason(Exception(GENERIC), [AUTH_TEXT])
    assert AUTH_TEXT in str(caught.value)
    assert ai._is_auth_failure(caught.value)


def test_a_reason_already_present_is_not_duplicated():
    exc = Exception(f"{GENERIC} — {AUTH_TEXT}")
    with pytest.raises(Exception) as caught:
        ai._reraise_with_reason(exc, [AUTH_TEXT])
    assert str(caught.value).count("OAuth session expired") == 1


def test_no_text_seen_reraises_unchanged():
    original = Exception(GENERIC)
    with pytest.raises(Exception) as caught:
        ai._reraise_with_reason(original, [])
    assert str(caught.value) == GENERIC


def test_the_other_transient_causes_still_retry():
    for text in ("HTTP 429 rate limit", "overloaded", "503 service unavailable",
                 "Reached maximum number of turns (3)",
                 "Control request timeout: initialize"):
        exc = Exception(text)
        assert ai._is_retryable(exc), text
        assert not ai._is_auth_failure(exc), text


def test_the_auth_wordings_the_cli_uses():
    for text in ("Failed to authenticate: OAuth session expired",
                 "could not be refreshed", "Invalid API key",
                 "authentication_error", "Please run /login",
                 "Unauthorized"):
        assert ai._is_auth_failure(Exception(text)), text


def test_the_fix_is_in_the_message_the_user_sees():
    """A diagnosis with no instruction is a diagnosis the user pays for twice."""
    assert "claude setup-token" in ai.AUTH_FIX
    assert "CLAUDE_CODE_OAUTH_TOKEN" in ai.AUTH_FIX


def test_all_three_channels_guard_their_stream():
    """review(), review_vision() and research() must each carry the reason —
    a channel that does not is a channel that reports the wrong cause."""
    import ast as _ast
    tree = _ast.parse(open(ai.__file__).read())
    guarded = set()
    for node in _ast.walk(tree):
        if not isinstance(node, (_ast.AsyncFunctionDef, _ast.FunctionDef)):
            continue
        body = _ast.dump(node)
        if "_reraise_with_reason" in body:
            guarded.add(node.name)
    for channel in ("_ask_inner", "_ask_vision_inner", "_ask_search_inner"):
        assert channel in guarded, f"{channel} does not carry the reason"


def test_the_live_auth_check_exists_and_returns_the_fix():
    """preflight has to be able to answer "are you signed in" before a run, not
    after one."""
    assert callable(ai.check_auth)
    import inspect
    source = inspect.getsource(ai.check_auth)
    assert "_is_auth_failure" in source and "auth_fix()" in source


def test_the_advice_depends_on_which_credential_failed():
    """Told wrong, the advice sends the user round the loop they are in:
    `claude setup-token` mints a token FROM a live login, so telling someone
    whose login has expired to run it first yields a placeholder, which is then
    refused, which looks exactly like the original failure. Ajay hit this."""
    import os
    saved = os.environ.pop("CLAUDE_CODE_OAUTH_TOKEN", None)
    try:
        no_token = ai.auth_fix()
        assert "stored Claude Code login has expired" in no_token
        assert "/login" in no_token and no_token.index("/login") < \
            no_token.index("setup-token"), "sign-in must come before minting"

        os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = "<token>"
        refused = ai.auth_fix()
        assert "REFUSED it" in refused
        assert "placeholder" in refused
        assert "env -u CLAUDE_CODE_OAUTH_TOKEN" in refused
        assert no_token != refused
    finally:
        os.environ.pop("CLAUDE_CODE_OAUTH_TOKEN", None)
        if saved is not None:
            os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = saved


def test_every_retry_loop_stops_dead_on_an_auth_failure():
    source = open(ai.__file__).read()
    loops = source.count("if _is_auth_failure(e):\n                raise")
    assert loops == 2, f"{loops} retry loops guarded, expected 2"
