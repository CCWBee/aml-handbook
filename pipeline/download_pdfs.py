"""Download JFSC Handbook PDFs from jerseyfsc.org. Idempotent."""

import os
import sys
from pathlib import Path

import requests
import yaml


def load_config():
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def download_file(url: str, dest: Path) -> bool:
    """Download a file if it doesn't already exist. Returns True if downloaded."""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [skip] {dest.name} already exists ({dest.stat().st_size:,} bytes)")
        return False

    print(f"  [download] {url}")
    resp = requests.get(url, timeout=60, headers={
        "User-Agent": "Mozilla/5.0 (JFSC Handbook Pipeline)"
    })
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    print(f"  [ok] {dest.name} ({len(resp.content):,} bytes)")
    return True


def main():
    config = load_config()
    base_url = config["base_url"]
    pdf_dir = Path(__file__).parent / "pdfs"
    pdf_dir.mkdir(exist_ok=True)

    downloaded = 0
    skipped = 0
    errors = []

    # Download section PDFs
    print("=== Downloading Section PDFs ===")
    for num, section in sorted(config["sections"].items()):
        filename = f"section-{num:02d}.pdf"
        dest = pdf_dir / filename
        url = base_url + section["pdf_path"]
        try:
            if download_file(url, dest):
                downloaded += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  [ERROR] Section {num}: {e}")
            errors.append(f"Section {num}: {e}")

    # Download extras (glossary, appendices)
    print("\n=== Downloading Extras ===")
    for key, extra in config.get("extras", {}).items():
        filename = f"{extra['output']}.pdf"
        dest = pdf_dir / filename
        url = base_url + extra["pdf_path"]
        try:
            if download_file(url, dest):
                downloaded += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  [ERROR] {key}: {e}")
            errors.append(f"{key}: {e}")

    print(f"\n=== Summary ===")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped (already existed): {skipped}")
    if errors:
        print(f"Errors: {len(errors)}")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
