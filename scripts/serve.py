"""Dev server: runs MkDocs serve on port 8001."""

import subprocess
import sys
from pathlib import Path

PYTHON = sys.executable
SITE_DIR = Path(__file__).parent.parent / "site"


def main():
    port = "8001"
    if len(sys.argv) > 1:
        port = sys.argv[1]

    print(f"Starting MkDocs dev server on http://127.0.0.1:{port}")
    print("Press Ctrl+C to stop\n")

    subprocess.run(
        [PYTHON, "-m", "mkdocs", "serve", "--dev-addr", f"127.0.0.1:{port}"],
        cwd=str(SITE_DIR),
    )


if __name__ == "__main__":
    main()
