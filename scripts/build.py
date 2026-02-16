"""Full pipeline orchestration: download → ingest → extract → normalize → build site."""

import subprocess
import sys
import time
from pathlib import Path

# Use the Python that's running this script
PYTHON = sys.executable
PIPELINE_DIR = Path(__file__).parent.parent / "pipeline"
SITE_DIR = Path(__file__).parent.parent / "site"


def run_step(name: str, script: str):
    """Run a pipeline step, printing output in real-time."""
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}\n")

    start = time.time()
    result = subprocess.run(
        [PYTHON, str(PIPELINE_DIR / script)],
        cwd=str(PIPELINE_DIR),
    )
    elapsed = time.time() - start
    print(f"\n  [{name}] completed in {elapsed:.1f}s (exit code {result.returncode})")

    if result.returncode != 0:
        print(f"  WARNING: {name} exited with errors")
    return result.returncode


def build_mkdocs():
    """Build the MkDocs site."""
    print(f"\n{'='*60}")
    print(f"  Building MkDocs Site")
    print(f"{'='*60}\n")

    start = time.time()
    result = subprocess.run(
        [PYTHON, "-m", "mkdocs", "build"],
        cwd=str(SITE_DIR),
    )
    elapsed = time.time() - start
    print(f"\n  [MkDocs Build] completed in {elapsed:.1f}s (exit code {result.returncode})")
    return result.returncode


def main():
    print("JFSC Handbook Pipeline")
    print("=" * 60)

    steps = [
        ("1. Download PDFs", "download_pdfs.py"),
        ("2. Ingest via Docling", "ingest.py"),
        ("3. Extract Colours", "extract_colours.py"),
        ("4. Normalize Markdown", "normalize.py"),
        ("5. Build Glossary", "build_glossary.py"),
        ("6. Build Cross-References", "build_crossrefs.py"),
    ]

    # Check for --skip-download flag
    skip_download = "--skip-download" in sys.argv
    skip_ingest = "--skip-ingest" in sys.argv

    total_start = time.time()

    for name, script in steps:
        if skip_download and "Download" in name:
            print(f"\n  [SKIP] {name}")
            continue
        if skip_ingest and "Ingest" in name:
            print(f"\n  [SKIP] {name}")
            continue

        run_step(name, script)

    # Build the MkDocs site
    rc = build_mkdocs()

    total_elapsed = time.time() - total_start
    print(f"\n{'='*60}")
    print(f"  Pipeline complete in {total_elapsed:.1f}s")
    print(f"{'='*60}")

    if rc == 0:
        print("\n  Site built to: build/")
        print("  Run 'python scripts/serve.py' to preview")
    else:
        print("\n  MkDocs build failed. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
