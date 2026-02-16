"""Extract font colours from JFSC PDFs to classify content types.

Uses pdfplumber to read non_stroking_color per text segment, then maps
colours to content types (requirement/guidance/example) based on config.

Outputs JSON sidecar files per section with paragraph-level tagging.
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber
import yaml


def load_config():
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def normalize_colour(colour):
    """Normalize a colour value to a tuple of floats 0-1."""
    if colour is None:
        return (0.0, 0.0, 0.0)  # Default to black
    if isinstance(colour, (int, float)):
        # Greyscale
        v = float(colour)
        return (v, v, v)
    if len(colour) == 1:
        v = float(colour[0])
        return (v, v, v)
    if len(colour) == 3:
        return tuple(float(c) for c in colour)
    if len(colour) == 4:
        # CMYK to RGB approximation
        c, m, y, k = [float(x) for x in colour]
        r = (1 - c) * (1 - k)
        g = (1 - m) * (1 - k)
        b = (1 - y) * (1 - k)
        return (r, g, b)
    return (0.0, 0.0, 0.0)


def colour_distance(c1, c2):
    """Euclidean distance between two RGB tuples."""
    return sum((a - b) ** 2 for a, b in zip(c1, c2)) ** 0.5


def classify_colour(colour, colour_map, threshold=0.15):
    """Classify a colour into a content type based on the colour map."""
    norm = normalize_colour(colour)

    best_type = None
    best_dist = float("inf")

    for content_type, reference_colours in colour_map.items():
        for ref in reference_colours:
            ref_tuple = tuple(float(x) for x in ref)
            dist = colour_distance(norm, ref_tuple)
            if dist < best_dist:
                best_dist = dist
                best_type = content_type

    if best_dist <= threshold:
        return best_type
    return None  # Colour doesn't match anything closely


def classify_by_keywords(text, keyword_patterns):
    """Fallback classification using keyword patterns."""
    text_lower = text.lower()
    for content_type, patterns in keyword_patterns.items():
        for pattern in patterns:
            if re.search(pattern, text_lower):
                return content_type
    return None


def extract_page_colours(page):
    """Extract text segments with their colours from a page."""
    segments = []
    chars = page.chars

    if not chars:
        return segments

    # Group consecutive characters with same colour into segments
    current_text = ""
    current_colour = None

    for char in chars:
        colour = char.get("non_stroking_color")
        norm = normalize_colour(colour)

        if current_colour is None:
            current_colour = norm
            current_text = char["text"]
        elif norm == current_colour:
            current_text += char["text"]
        else:
            if current_text.strip():
                segments.append({
                    "text": current_text.strip(),
                    "colour": list(current_colour),
                })
            current_text = char["text"]
            current_colour = norm

    if current_text.strip():
        segments.append({
            "text": current_text.strip(),
            "colour": list(current_colour),
        })

    return segments


def extract_pdf_colours(pdf_path: Path, config: dict) -> list[dict]:
    """Extract colour-tagged paragraphs from a PDF."""
    colour_map = config["colour_map"]
    keyword_patterns = config["keyword_patterns"]
    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            segments = extract_page_colours(page)

            for seg in segments:
                text = seg["text"]
                if len(text) < 5:  # Skip tiny fragments
                    continue

                # Try colour-based classification first
                content_type = classify_colour(seg["colour"], colour_map)

                # Fall back to keyword matching
                if content_type is None:
                    content_type = classify_by_keywords(text, keyword_patterns)

                # Default to requirement (black text = main body)
                if content_type is None:
                    content_type = "requirement"

                results.append({
                    "page": page_num,
                    "text_snippet": text[:100],
                    "content_type": content_type,
                    "colour_rgb": seg["colour"],
                })

    return results


def main():
    config = load_config()
    pdf_dir = Path(__file__).parent / "pdfs"
    colour_dir = Path(__file__).parent / "colours"
    colour_dir.mkdir(exist_ok=True)

    if not pdf_dir.exists():
        print("ERROR: pdfs/ directory not found. Run download_pdfs.py first.")
        sys.exit(1)

    # Also do a calibration pass on the first PDF to show colour distribution
    print("=== Extracting Colours ===")

    for num, section in sorted(config["sections"].items()):
        pdf_file = pdf_dir / f"section-{num:02d}.pdf"
        out_file = colour_dir / f"{section['slug']}.json"

        if out_file.exists():
            print(f"  [skip] {out_file.name} already exists")
            continue

        if not pdf_file.exists():
            print(f"  [WARN] {pdf_file.name} not found, skipping")
            continue

        print(f"  [extract] {pdf_file.name}")
        try:
            results = extract_pdf_colours(pdf_file, config)
            out_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
            print(f"  [ok] {out_file.name} ({len(results)} segments)")

            # Print colour distribution for calibration
            if num == 1:
                print("\n  --- Colour calibration (Section 1) ---")
                colour_counts = {}
                for r in results:
                    key = tuple(round(c, 3) for c in r["colour_rgb"])
                    colour_counts[key] = colour_counts.get(key, 0) + 1
                for colour, count in sorted(colour_counts.items(), key=lambda x: -x[1])[:10]:
                    print(f"    RGB{colour}: {count} segments")
                print()

        except Exception as e:
            print(f"  [ERROR] Section {num}: {e}")


if __name__ == "__main__":
    main()
