"""Ingest JFSC PDFs via Docling → raw markdown."""

import sys
from pathlib import Path

import yaml


def load_config():
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def ingest_pdf(pdf_path: Path, output_path: Path):
    """Convert a single PDF to markdown via Docling."""
    from docling.document_converter import DocumentConverter

    print(f"  [ingest] {pdf_path.name}")
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))

    md = result.document.export_to_markdown()
    output_path.write_text(md, encoding="utf-8")
    print(f"  [ok] {output_path.name} ({len(md):,} chars)")


def main():
    config = load_config()
    pdf_dir = Path(__file__).parent / "pdfs"
    raw_dir = Path(__file__).parent / "raw"
    raw_dir.mkdir(exist_ok=True)

    if not pdf_dir.exists():
        print("ERROR: pdfs/ directory not found. Run download_pdfs.py first.")
        sys.exit(1)

    errors = []

    # Ingest section PDFs
    print("=== Ingesting Section PDFs ===")
    for num, section in sorted(config["sections"].items()):
        pdf_file = pdf_dir / f"section-{num:02d}.pdf"
        out_file = raw_dir / f"{section['slug']}.md"

        if out_file.exists() and out_file.stat().st_size > 0:
            print(f"  [skip] {out_file.name} already exists")
            continue

        if not pdf_file.exists():
            print(f"  [WARN] {pdf_file.name} not found, skipping")
            errors.append(f"Missing PDF: {pdf_file.name}")
            continue

        try:
            ingest_pdf(pdf_file, out_file)
        except Exception as e:
            print(f"  [ERROR] Section {num}: {e}")
            errors.append(f"Section {num}: {e}")

    # Ingest extras
    print("\n=== Ingesting Extras ===")
    for key, extra in config.get("extras", {}).items():
        pdf_file = pdf_dir / f"{extra['output']}.pdf"
        out_file = raw_dir / f"{extra['output']}.md"

        if out_file.exists() and out_file.stat().st_size > 0:
            print(f"  [skip] {out_file.name} already exists")
            continue

        if not pdf_file.exists():
            print(f"  [WARN] {pdf_file.name} not found, skipping")
            errors.append(f"Missing PDF: {pdf_file.name}")
            continue

        try:
            ingest_pdf(pdf_file, out_file)
        except Exception as e:
            print(f"  [ERROR] {key}: {e}")
            errors.append(f"{key}: {e}")

    if errors:
        print(f"\n{len(errors)} errors occurred:")
        for e in errors:
            print(f"  - {e}")


if __name__ == "__main__":
    main()
