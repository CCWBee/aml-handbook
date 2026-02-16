import os
import subprocess
import tempfile
import shutil
import json
from pathlib import Path

# Ensure pandoc is findable on Windows (may not be on bash PATH)
_pandoc_dir = r"C:\Users\Charles\OneDrive\Desktop\Stuff\Work\pandoc-3.6.4"
if os.path.isdir(_pandoc_dir):
    os.environ["PATH"] = _pandoc_dir + os.pathsep + os.environ.get("PATH", "")

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Doc Converter", version="2.0.0")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Docling converter - lazy-loaded so startup isn't slow
_docling_converter = None

def get_docling_converter():
    global _docling_converter
    if _docling_converter is None:
        from docling.document_converter import DocumentConverter
        _docling_converter = DocumentConverter()
    return _docling_converter

# Docling handles these best (semantic/OCR-heavy)
DOCLING_INPUTS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".pptx", ".xlsx", ".docx"}
# Pandoc handles these (already text-based)
PANDOC_INPUTS = {".odt", ".rtf", ".epub", ".md", ".rst", ".tex", ".html", ".htm", ".txt", ".csv", ".tsv"}

PANDOC_OUTPUTS = {"html", "docx", "pdf", "rst", "latex", "plain", "epub"}


def ingest_to_markdown(input_path: Path) -> str:
    """Stage 1: Any file → Markdown. Uses the best tool for the input type."""
    ext = input_path.suffix.lower()

    if ext in DOCLING_INPUTS:
        converter = get_docling_converter()
        doc = converter.convert(str(input_path))
        return doc.document.export_to_markdown()

    if ext in PANDOC_INPUTS:
        result = subprocess.run(
            ["pandoc", str(input_path), "-t", "markdown", "--standalone"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Pandoc ingest error: {result.stderr}")
        return result.stdout

    raise HTTPException(status_code=400, detail=f"Unsupported input format: {ext}")


def markdown_to_output(markdown: str, output_fmt: str, output_dir: Path, stem: str) -> Path:
    """Stage 2: Markdown → Any output format via Pandoc."""
    if output_fmt == "markdown":
        out_path = output_dir / f"{stem}.md"
        out_path.write_text(markdown, encoding="utf-8")
        return out_path

    ext_map = {"html": ".html", "docx": ".docx", "pdf": ".pdf",
               "rst": ".rst", "latex": ".tex", "plain": ".txt", "epub": ".epub"}
    out_ext = ext_map.get(output_fmt, ".html")
    md_path = output_dir / "intermediate.md"
    md_path.write_text(markdown, encoding="utf-8")
    out_path = output_dir / f"{stem}{out_ext}"

    result = subprocess.run(
        ["pandoc", str(md_path), "-f", "markdown", "-t", output_fmt,
         "-o", str(out_path), "--standalone"],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Pandoc output error: {result.stderr}")
    return out_path


# --- Stage 1: Ingest any file to markdown ---

@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    """Upload any supported file, get markdown back."""
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        input_path = tmp_dir / file.filename
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        engine = "docling" if input_path.suffix.lower() in DOCLING_INPUTS else "pandoc"
        md = ingest_to_markdown(input_path)

        return PlainTextResponse(
            md,
            headers={"X-Ingest-Engine": engine}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Stage 2: Convert markdown to output format ---

@app.post("/output")
async def output(
    markdown: str = Form(...),
    output_format: str = Form("html"),
    filename: str = Form("document"),
):
    """Take markdown text, convert to desired output format."""
    if output_format not in {"markdown", *PANDOC_OUTPUTS}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported output format. Valid: markdown, {', '.join(sorted(PANDOC_OUTPUTS))}"
        )

    tmp_dir = Path(tempfile.mkdtemp())
    try:
        stem = Path(filename).stem
        out_path = markdown_to_output(markdown, output_format, tmp_dir, stem)

        return FileResponse(
            out_path,
            filename=out_path.name,
            media_type="application/octet-stream",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- One-shot: file in, converted file out (both stages) ---

@app.post("/convert")
async def convert(
    file: UploadFile = File(...),
    output_format: str = Form("html"),
):
    """Full pipeline: any file → markdown → output format."""
    if output_format not in {"markdown", *PANDOC_OUTPUTS}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported output format. Valid: markdown, {', '.join(sorted(PANDOC_OUTPUTS))}"
        )

    tmp_dir = Path(tempfile.mkdtemp())
    try:
        input_path = tmp_dir / file.filename
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        md = ingest_to_markdown(input_path)
        stem = input_path.stem
        out_path = markdown_to_output(md, output_format, tmp_dir, stem)

        engine = "docling" if input_path.suffix.lower() in DOCLING_INPUTS else "pandoc"
        return FileResponse(
            out_path,
            filename=out_path.name,
            media_type="application/octet-stream",
            headers={"X-Ingest-Engine": engine},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/", response_class=HTMLResponse)
async def index():
    return Path("static/index.html").read_text(encoding="utf-8")


@app.get("/health")
async def health():
    pandoc_ok = shutil.which("pandoc") is not None
    return {"status": "ok", "pandoc": pandoc_ok, "docling": True}
