#!/usr/bin/env python3
"""
client.py — the model boundary, wired to the AETRAA subscription layer.

This is the SDK build. The provider call goes through core/ai.py, which is
AETRAA's own Claude-subscription layer, ported whole from AETRAA_SDK and
already proven on the Tender-IFC agent. No API key, no per-use charge: it
runs on the Claude Code CLI login (CLAUDE_CODE_OAUTH_TOKEN).

What core/ai.py brings that a fresh implementation would have had to learn
the expensive way, and why each one is there:

  max_turns=4       a cap of 1 turns a slightly chatty reply into a hard
                    "Reached maximum number of turns" failure
  timeout 240s      120s was killing about 7% of calls
  channel override  appended LAST to the system prompt, because a seat rule
                    requiring a web search is a system-level law and a
                    user-turn note cannot override it. On a tool-less
                    channel the model would obey it, burn its turn and
                    return nothing
  circuit breaker   4 consecutive failures or 3 consecutive timeouts
  model pinned      a call never runs on the CLI's ambient default, which
                    could be Haiku
  API key warning   ANTHROPIC_API_KEY set means you are silently paying API
                    rates while believing you are on your subscription

What this file adds on top, and core/ai.py does not have: schema validation
before any response is read, and the refusal of any response carrying a
number. core.ai returns parsed JSON; whether that JSON is ALLOWED is decided
here.

Two behaviours differ from the Tender-IFC agent deliberately:

  * core.ai returns None when the model is unreachable, and Tender-IFC keeps
    its deterministic result so a run never fails because of AI. This
    pipeline has no deterministic fallback for a classification, so None
    becomes a gap the element carries into the output. Absence stays
    visible rather than being papered over.
  * review_vision is NOT reachable from this pipeline. It exists in
    core/ai.py and is guarded off below, because a model that reads a
    drawing and returns a measurement violates invariant 1.

  python3 -m model.client --ping
  python3 -m model.client --selftest

Exit 0 = reachable. Exit 2 = not configured or unreachable.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field

from model import schema

# The tool-less judgement channel only. Vision is deliberately not imported.
try:
    from core.ai import check_env, report, review, selftest as _ai_selftest
    from core.ai import DEFAULT_MODEL
    AI_AVAILABLE = True
except ImportError as _exc:                      # core/ not present
    AI_AVAILABLE = False
    _IMPORT_ERROR = _exc
    DEFAULT_MODEL = None

VISION_ENABLED = False       # invariant 1. Do not flip without a GP1.2 note.
# Transcription is not measurement: readers.transcribe reads the printed cells
# of a drawn schedule and the fields of a drawn title block - values the sheet
# STATES - and nothing else, each carried as Origin.TRANSCRIBED. The GP1.2 note
# is in DECISIONS.md ("Transcription of drawn values"). review_vision below
# stays guarded: no stage may ask the model to measure.
TRANSCRIPTION_ENABLED = True

SYSTEM = (
    "You are a senior quantity surveyor classifying evidence for a bill of "
    "quantities measured to POMI.\n"
    "Return ONLY the requested label or identifier, as JSON.\n"
    "You must NOT return a quantity, dimension, area, volume, weight, rate "
    "or total. A numeric measurement in your response is a failure of the "
    "task and the run will be stopped.\n"
    "Where you cannot answer from the evidence given, say so for that item "
    "rather than inferring one."
)


class ModelUnavailable(RuntimeError):
    """The model could not be reached. The caller records a gap; it does not
    substitute a default, because a default is indistinguishable from a
    judgement once it is in a cell."""


@dataclass(frozen=True)
class Request:
    judgement: str              # key into schema.SCHEMAS
    context: dict               # the evidence for THIS judgement only
    guidance: str = ""          # that section's chunk, never the whole corpus
    enum: tuple = field(default_factory=tuple)

    def cache_key(self) -> str:
        """Identical requests inside one run are answered once. Content-keyed,
        so the cache cannot serve a different judgement's answer."""
        import hashlib
        digest = hashlib.sha256()
        for part in (self.judgement, json.dumps(self.context, sort_keys=True),
                     self.guidance, "\x00".join(sorted(self.enum))):
            digest.update(part.encode("utf-8"))
            digest.update(b"\x1e")
        return digest.hexdigest()


@dataclass(frozen=True)
class Response:
    judgement: str
    payload: dict
    call_id: str


class ModelClient:
    """The only place a provider is reached. Nothing upstream imports it."""

    def __init__(self, config=None, model: str | None = None):
        self.config = config
        self.model = model or DEFAULT_MODEL
        self._cache: dict[str, Response] = {}

    def ask(self, request: Request) -> Response:
        key = request.cache_key()
        if key in self._cache:
            return self._cache[key]
        payload = self._call(request)
        schema.validate(request.judgement, payload)   # halts on a number
        response = Response(request.judgement, payload, key[:12])
        self._cache[key] = response
        return response

    def _call(self, request: Request) -> dict:
        if not AI_AVAILABLE:
            raise ModelUnavailable(
                f"core/ai.py not importable: {_IMPORT_ERROR}. "
                "pip install claude-agent-sdk, and run from this folder.")
        from model.prompts import render
        instructions = render(request.judgement,
                              **{**request.context,
                                 "enum": ", ".join(request.enum)})
        system = SYSTEM + (f"\n\nSection guidance:\n{request.guidance}"
                           if request.guidance else "")
        out = review(instructions, request.context, system=system,
                     label=f"boq:{request.judgement}", model=self.model)
        if out is None:
            raise ModelUnavailable(
                f"no response for {request.judgement} — breaker open, timeout "
                "or unparseable reply. Record a gap; do not substitute.")
        # core.ai.review hands back a LIST (parse_json_array unwraps arrays,
        # wrapper keys and ref-keyed objects alike). A batched judgement is
        # carried as {"items": [...]}; a single-object judgement that came
        # back as a one-element list is unwrapped.
        spec = schema.SCHEMAS.get(request.judgement, {})
        if isinstance(out, list):
            if spec.get("item_required"):
                out = {"items": out}
            elif len(out) == 1 and isinstance(out[0], dict):
                out = out[0]
            else:
                out = {"items": out}
        elif isinstance(out, dict) and spec.get("item_required") \
                and "items" not in out:
            out = {"items": [out]}
        return out


def review_vision(*_args, **_kwargs):
    """Guarded off. core/ai.py carries a vision channel that gives the model
    the Read tool so it measures from a drawing. That is how the Tender-IFC
    agent works and it is why its figures carry a basis and a confidence.

    This pipeline forbids it: invariant 1, the model never produces a number
    that reaches the bill. Quantities come from schedule cells, counted
    symbols and stated levels, computed by code from the governing clause."""
    raise NotImplementedError(
        "vision is disabled in the BOQ agent — invariant 1. A model may not "
        "produce a measurement. See DECISIONS.md and README.md.")


def main() -> int:
    ap = argparse.ArgumentParser(description="Check the model boundary.")
    ap.add_argument("--ping", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    if not AI_AVAILABLE:
        print(f"core/ai.py not importable: {_IMPORT_ERROR}", file=sys.stderr)
        return 2

    print(f"judgements : {', '.join(sorted(schema.SCHEMAS))}")
    print(f"model      : {DEFAULT_MODEL}")
    print(f"vision     : {'ENABLED' if VISION_ENABLED else 'disabled (invariant 1)'}")
    if os.environ.get("ANTHROPIC_API_KEY"):
        print("WARNING: ANTHROPIC_API_KEY is set — unset it to run on your "
              "subscription instead of the paid API.", file=sys.stderr)
    check_env()
    if args.report:
        report()
    if args.selftest:
        return 0 if _ai_selftest() else 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
