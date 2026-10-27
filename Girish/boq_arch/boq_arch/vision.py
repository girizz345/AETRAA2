"""Visual reading of what the drawings only carry as graphics.

Chain, first that answers wins:
  1. a saved reading  (readings/<id>.json - from an earlier run, or written by a person / Claude Code)
  2. Claude           (ANTHROPIC_API_KEY)
  3. OpenAI           (OPENAI_API_KEY)
  4. Gemini           (GEMINI_API_KEY or GOOGLE_API_KEY)
  5. Claude sign-in   ("claude-login": the user's own Claude Code sign-in, on runs on the user's own computer only)
A provider that is out of quota, rate limited, overloaded or unauthorised hands
over to the next. If none answers, the rendered tiles and the prompt are written
to readings/<id>.request/ and the reading is a named gap - never a guess.

A reading is bound to the sheet's SHA-1 and the task's prompt version, so a
changed drawing or a changed prompt is read again, and an unchanged one is not.
"""
from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

import pymupdf

from .sheet import Sheet

MAX_TILE_PX = 1568   # long edge the providers keep without downscaling


@dataclass
class Task:
    name: str
    version: str
    prompt: str
    schema: dict
    clips: list[tuple[float, float, float, float]] | None = None   # fractions of the sheet (x0,y0,x1,y1)
    grid: tuple[int, int] = (1, 1)      # tiles per clip (cols, rows)
    dpi: int = 200
    # a tight crop found on the sheet itself instead of fixed clips:
    #   "table" - the schedule table's ruled outline;  "title_block" - the title block panel
    crop: str | None = None


class ProviderUnavailable(Exception):
    """Out of quota / rate limited / overloaded / no key: try the next provider."""


# ----------------------------------------------------------------- providers

def _claude(images: list[bytes], prompt: str, schema: dict) -> dict:
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        raise ProviderUnavailable("no Anthropic credentials")
    import anthropic
    client = anthropic.Anthropic()
    content = [{"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                            "data": base64.standard_b64encode(b).decode()}}
               for b in images]
    content.append({"type": "text", "text": prompt})
    try:
        with client.messages.stream(
            model=os.environ.get("BOQ_CLAUDE_MODEL", "claude-opus-5"),
            max_tokens=32000,
            thinking={"type": "adaptive"},
            output_config={"effort": "high", "format": {"type": "json_schema", "schema": schema}},
            messages=[{"role": "user", "content": content}],
        ) as stream:
            msg = stream.get_final_message()
    except (anthropic.RateLimitError, anthropic.AuthenticationError,
            anthropic.PermissionDeniedError, anthropic.InternalServerError,
            anthropic.APIConnectionError) as e:
        raise ProviderUnavailable(f"Claude: {type(e).__name__}: {e}") from e
    except anthropic.APIStatusError as e:
        if e.status_code in (402, 529) or getattr(e, "type", "") in ("billing_error", "overloaded_error"):
            raise ProviderUnavailable(f"Claude: {e.status_code} {e.message}") from e
        raise
    if msg.stop_reason == "refusal":
        raise ProviderUnavailable("Claude declined the request")
    text = "".join(b.text for b in msg.content if b.type == "text")
    return json.loads(text)


def _openai(images: list[bytes], prompt: str, schema: dict) -> dict:
    if not os.environ.get("OPENAI_API_KEY"):
        raise ProviderUnavailable("no OpenAI credentials")
    import openai
    client = openai.OpenAI()
    content = [{"type": "input_image",
                "image_url": "data:image/png;base64," + base64.b64encode(b).decode()} for b in images]
    content.append({"type": "input_text", "text": prompt})
    try:
        resp = client.responses.create(
            model=os.environ.get("BOQ_OPENAI_MODEL", "gpt-5"),
            input=[{"role": "user", "content": content}],
            text={"format": {"type": "json_schema", "name": "reading", "schema": schema, "strict": True}},
        )
    except (openai.RateLimitError, openai.AuthenticationError, openai.PermissionDeniedError,
            openai.InternalServerError, openai.APIConnectionError) as e:
        raise ProviderUnavailable(f"OpenAI: {type(e).__name__}: {e}") from e
    return json.loads(resp.output_text)


def _gemini(images: list[bytes], prompt: str, schema: dict) -> dict:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise ProviderUnavailable("no Gemini credentials")
    from google import genai
    from google.genai import errors, types
    client = genai.Client(api_key=key)
    parts = [types.Part.from_bytes(data=b, mime_type="image/png") for b in images]
    try:
        resp = client.models.generate_content(
            model=os.environ.get("BOQ_GEMINI_MODEL", "gemini-2.5-pro"),
            contents=parts + [prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json",
                                               response_json_schema=schema),
        )
    except errors.APIError as e:
        if getattr(e, "code", 0) in (401, 403, 429, 500, 503):
            raise ProviderUnavailable(f"Gemini: {e}") from e
        raise
    return json.loads(resp.text)


def _claude_login(images: list[bytes], prompt: str, schema: dict) -> dict:
    """The user's own Claude sign-in (Claude Code), for runs on the user's own computer only.

    Anthropic's terms let a subscriber use their own sign-in for their own work, not to serve other people, so
    this reader works only when the run says it is local (BOQ_CLAUDE_LOGIN=1): the platform sets that for a run
    started on this computer, never for one that came in over a shared link. Least privilege: Claude Code may
    only use its Read tool, on the tile images in a temporary folder, and its answer is the task's JSON."""
    if os.environ.get("BOQ_CLAUDE_LOGIN") != "1":
        raise ProviderUnavailable("Claude sign-in not used (only for runs on this computer)")
    try:
        import asyncio
        import shutil
        import tempfile
        from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, TextBlock, query
    except ImportError:
        raise ProviderUnavailable("Claude sign-in: claude-agent-sdk is not installed (pip install claude-agent-sdk)")
    timeout = int(os.environ.get("BOQ_CLAUDE_LOGIN_TIMEOUT", "900"))
    # removed by hand: on Windows the folder is still Claude Code's working folder for a moment after it answers,
    # and a TemporaryDirectory that cannot delete it failed the whole run
    d = tempfile.mkdtemp(prefix="boq-read-")
    try:
        paths = []
        for i, b in enumerate(images, 1):
            p = Path(d) / f"tile_{i:02d}.png"
            p.write_bytes(b)
            paths.append(str(p))
        ask = (prompt + "\n\nLook at each of these image files with the Read tool - they are the tiles to read, "
               "in order:\n" + "\n".join(paths)
               + "\n\nReply with ONLY one JSON object that fits this JSON schema - no prose, no code fence:\n"
               + json.dumps(schema))
        # a large sheet's tiles come back through the Read tool in messages far over the SDK's 1 MB default
        options = ClaudeAgentOptions(allowed_tools=["Read"], max_turns=12, cwd=d, max_buffer_size=64 * 1024 * 1024,
                                     model=os.environ.get("BOQ_CLAUDE_LOGIN_MODEL") or None,
                                     system_prompt="You read construction drawings for a quantity surveyor and "
                                                   "reply with JSON only.")

        async def run() -> str:
            chunks = []
            async for m in query(prompt=ask, options=options):
                if isinstance(m, AssistantMessage):
                    chunks += [c.text for c in m.content if isinstance(c, TextBlock)]
            return "".join(chunks)
        try:
            text = asyncio.run(asyncio.wait_for(run(), timeout))
        except asyncio.TimeoutError:
            raise ProviderUnavailable(f"Claude sign-in: no answer within {timeout} s")
        except Exception as e:                      # not signed in, the CLI missing, a usage limit ...
            raise ProviderUnavailable(f"Claude sign-in: {type(e).__name__}: {str(e)[:200]}") from e
    finally:
        shutil.rmtree(d, ignore_errors=True)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ProviderUnavailable("Claude sign-in: the answer held no JSON")
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise ProviderUnavailable(f"Claude sign-in: the answer was not valid JSON ({e})") from e


PROVIDERS = {"claude": _claude, "openai": _openai, "gemini": _gemini, "claude-login": _claude_login}


# ----------------------------------------------------------------- tiles

def crop_rects(sheet: Sheet, task: Task) -> list[pymupdf.Rect]:
    """The regions a task reads: a tight crop found on the sheet, or the task's fixed clips."""
    from .readability import EMPTY, classify_region, table_rect, tight_tiles, title_block_rect
    if task.crop == "table":
        return tight_tiles(table_rect(sheet))
    if task.crop == "title_block":
        tb = title_block_rect(sheet)
        # a sheet with no title block where one belongs (a cover sheet) is read whole
        if classify_region(sheet, tb).cls == EMPTY:
            return [sheet.page.rect]
        # a long block (a full-height strip down the right edge) is read in overlapping tiles: as one image it
        # would be shrunk to ~70 dpi, too small to read its fields
        return tight_tiles(tb, 620, 620) if max(tb.width, tb.height) > 800 else [tb]
    return []


def tiles(sheet: Sheet, task: Task) -> list[bytes]:
    W, H = sheet.width, sheet.height
    rects = crop_rects(sheet, task)
    if rects:
        out = []
        for r in rects:
            long_pt = max(r.width, r.height)
            out.append(sheet.render_png(min(task.dpi, int(MAX_TILE_PX / (long_pt / 72))), r))
        return out
    out = []
    clips, grid = task.clips, task.grid
    if task.name == "levels":
        from .readability import _tb_candidates, title_block_rect
        if title_block_rect(sheet) != _tb_candidates(W, H)[0]:
            # the house set prints its main section down the left third of the sheet; another office's can be
            # anywhere (IIT Bombay's to the right of a ceiling plan), so its whole drawing area is read
            clips, grid = [(0.0, 0.0, 0.98, 0.97)], (2, 2)
    for fx0, fy0, fx1, fy1 in clips or [(0, 0, 1, 1)]:
        cols, rows = grid
        cw, ch = (fx1 - fx0) * W / cols, (fy1 - fy0) * H / rows
        ov = 0.04  # overlap so a row cut by a tile edge is whole in its neighbour
        for r in range(rows):
            for c in range(cols):
                x0 = fx0 * W + c * cw - (ov * cw if c else 0)
                y0 = fy0 * H + r * ch - (ov * ch if r else 0)
                x1 = fx0 * W + (c + 1) * cw + (ov * cw if c < cols - 1 else 0)
                y1 = fy0 * H + (r + 1) * ch + (ov * ch if r < rows - 1 else 0)
                long_pt = max(x1 - x0, y1 - y0)
                dpi = min(task.dpi, int(MAX_TILE_PX / (long_pt / 72)))
                out.append(sheet.render_png(dpi, pymupdf.Rect(x0, y0, x1, y1)))
    return out


# ----------------------------------------------------------------- reader

def write_atomic(path: Path, data: bytes) -> None:
    """Write the whole file or nothing: runs and their workers share the readings folder, and another process
    must never read half a reading."""
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_bytes(data)
    for attempt in range(20):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:          # Windows: another process has the file open this instant
            if attempt == 19:
                raise
            time.sleep(0.05)


class Reader:
    def __init__(self, folder: Path, order: list[str] | None = None, log=print):
        self.folder = folder
        self.folder.mkdir(parents=True, exist_ok=True)
        self.order = order if order is not None else ["claude", "openai", "gemini", "claude-login"]
        self.log = log
        self.pending: list[str] = []

    def read(self, sheet: Sheet, drawing_no: str, task: Task) -> tuple[dict | None, str]:
        """Returns (reading, provenance). reading is None when nobody could read it."""
        rid = f"{drawing_no}.{task.name}"
        saved = self.folder / f"{rid}.json"
        stamp = {"sheet_sha1": sheet.sha1, "task": task.name, "version": task.version}
        if saved.exists():
            doc = json.loads(saved.read_text(encoding="utf-8"))
            if all(doc.get("_stamp", {}).get(k) == v for k, v in stamp.items()):
                return doc["reading"], f"saved reading ({doc.get('_by', 'unknown')})"
            self.log(f"  {rid}: saved reading is stale (drawing or prompt changed) - reading again")
        images = tiles(sheet, task)
        errors = []
        for name in self.order:
            try:
                reading = PROVIDERS[name](images, task.prompt, task.schema)
            except ProviderUnavailable as e:
                errors.append(str(e))
                continue
            write_atomic(saved, json.dumps({"_stamp": stamp, "_by": name, "reading": reading},
                                           indent=1, ensure_ascii=False).encode("utf-8"))
            # a request an earlier run left for this reading is answered now; left behind, it would still be
            # listed as waiting
            import shutil
            shutil.rmtree(self.folder / f"{rid}.request", ignore_errors=True)
            return reading, f"read by {name}"
        # nobody answered: leave a request someone (or Claude Code) can fulfil
        req = self.folder / f"{rid}.request"
        req.mkdir(exist_ok=True)
        for i, b in enumerate(images, 1):
            write_atomic(req / f"tile_{i:02d}.png", b)
        write_atomic(req / "request.json", json.dumps(
            {"_stamp": stamp, "answer_to": saved.name, "prompt": task.prompt, "schema": task.schema,
             "tiles": len(images), "providers_tried": errors}, indent=1).encode("utf-8"))
        self.pending.append(rid)
        return None, "; ".join(errors) or "no provider configured"
