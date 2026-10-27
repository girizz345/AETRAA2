"""Multi-format input: every drawing becomes a PDF page the rest of the tool can read, view and measure.

  PDF            used as it is
  JPG/PNG/TIFF   each image (each page of a multi-page TIFF) becomes a one-page PDF - a RASTER sheet:
                 no text layer, so its title block and schedules are read visually; measured by hand
                 after Set scale
  DXF            rendered to a PDF page for viewing; the DXF itself stays beside it, so cad.py measures
                 that sheet from native geometry (same file stem)
  DWG            converted to DXF with the ODA File Converter when it is installed (free, from the Open
                 Design Alliance), then as DXF; without it the file is listed as not readable - never guessed

The converted files go to a folder of their own; the source folder is never written to.
"""
from __future__ import annotations

import glob
import os
import shutil
import subprocess
from pathlib import Path

import pymupdf

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}
CAD_EXT = {".dxf", ".dwg"}
ACCEPTED = {".pdf"} | IMAGE_EXT | CAD_EXT | {".zip"}


def oda_converter() -> Path | None:
    for pat in (r"C:\Program Files\ODA\ODAFileConverter*\ODAFileConverter.exe",
                r"C:\Program Files (x86)\ODA\ODAFileConverter*\ODAFileConverter.exe"):
        hits = sorted(glob.glob(pat))
        if hits:
            return Path(hits[-1])
    env = os.environ.get("ODA_FILE_CONVERTER")
    return Path(env) if env and Path(env).exists() else None


def image_to_pdf(src: Path, out_dir: Path) -> list[Path]:
    """One PDF per image page, at the image's own resolution (a 300 dpi scan stays 300 dpi)."""
    import io
    from PIL import Image, ImageSequence
    out = []
    im = Image.open(src)
    frames = [f.copy() for f in ImageSequence.Iterator(im)]     # the iterator reuses one object: copy each page
    for i, frame in enumerate(frames):
        name = src.stem + (f" p{i + 1}" if len(frames) > 1 else "") + ".pdf"
        dpi = float(frame.info.get("dpi", im.info.get("dpi", (150, 150)))[0] or 150)   # TIFF gives a fraction
        rgb = frame.convert("RGB")
        buf = io.BytesIO()
        rgb.save(buf, format="PNG")
        doc = pymupdf.open()
        page = doc.new_page(width=rgb.width * 72 / dpi, height=rgb.height * 72 / dpi)
        page.insert_image(page.rect, stream=buf.getvalue())
        dst = out_dir / name
        doc.save(dst, deflate=True)
        doc.close()
        out.append(dst)
    return out


def dxf_to_pdf(src: Path, out_dir: Path) -> Path:
    """Render a DXF's modelspace to a PDF page (for viewing, title-block reading and hand measuring);
    the DXF is copied beside it so the sheet is also measured from its native geometry."""
    import ezdxf
    from ezdxf.addons.drawing import Frontend, RenderContext, layout
    from ezdxf.addons.drawing import pymupdf as pmb
    doc = ezdxf.readfile(str(src))
    msp = doc.modelspace()
    backend = pmb.PyMuPdfBackend()
    Frontend(RenderContext(doc), backend).draw_layout(msp)
    # plotted onto an A1 sheet, as a drawing would be; the CAD file itself keeps the true geometry
    page = layout.Page(841, 594, layout.Units.mm, margins=layout.Margins.all(10))
    data = backend.get_pdf_bytes(page, settings=layout.Settings(fit_page=True))
    dst = out_dir / (src.stem + ".pdf")
    dst.write_bytes(data)
    shutil.copy2(src, out_dir / src.name)
    return dst


def dwg_to_dxf(src: Path, out_dir: Path) -> Path | None:
    exe = oda_converter()
    if exe is None:
        return None
    work_in, work_out = out_dir / "_dwg_in", out_dir / "_dwg_out"
    work_in.mkdir(exist_ok=True)
    work_out.mkdir(exist_ok=True)
    shutil.copy2(src, work_in / src.name)
    subprocess.run([str(exe), str(work_in), str(work_out), "ACAD2018", "DXF", "0", "1", "*.DWG"],
                   capture_output=True, timeout=600)
    dxf = work_out / (src.stem + ".dxf")
    return dxf if dxf.exists() else None


def convert_folder(src: Path, out_dir: Path, log=print) -> tuple[list[Path], list[tuple[str, str]]]:
    """Convert every non-PDF drawing under src into out_dir. Returns (files made, [(file, problem)])."""
    made, problems = [], []
    todo = [p for p in sorted(src.rglob("*")) if p.is_file() and p.suffix.lower() in (IMAGE_EXT | CAD_EXT)]
    if not todo:
        return made, problems
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in todo:
        ext = p.suffix.lower()
        try:
            if ext in IMAGE_EXT:
                made += image_to_pdf(p, out_dir)
                log(f"   {p.name}: image -> PDF (raster sheet: read visually, measured by hand)")
            elif ext == ".dxf":
                if (p.with_suffix(".pdf")).exists():
                    shutil.copy2(p, out_dir / p.name)      # the PDF is in the set; the DXF measures it
                    log(f"   {p.name}: DXF beside its PDF - measured from native geometry")
                else:
                    made.append(dxf_to_pdf(p, out_dir))
                    log(f"   {p.name}: DXF rendered to PDF")
            elif ext == ".dwg":
                dxf = dwg_to_dxf(p, out_dir)
                if dxf is None:
                    problems.append((p.name, "DWG needs the free ODA File Converter (Open Design Alliance) installed "
                                             "to be read, or save it as DXF/PDF - not read"))
                    continue
                if (p.with_suffix(".pdf")).exists():
                    shutil.copy2(dxf, out_dir / (p.stem + ".dxf"))
                else:
                    made.append(dxf_to_pdf(dxf, out_dir))
                log(f"   {p.name}: DWG converted to DXF")
        except Exception as e:  # a file that will not open is a named problem, not a crash
            problems.append((p.name, f"could not be converted: {e}"))
    return made, problems
