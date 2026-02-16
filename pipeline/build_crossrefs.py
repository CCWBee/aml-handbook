"""Build cross-reference links between handbook sections.

Scans all normalized section markdown for references like "Section 4.3.1"
and replaces them with clickable markdown links to the correct page and anchor.
"""

import re
from pathlib import Path

import yaml


def load_config():
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def slugify(text: str) -> str:
    """Convert heading text to MkDocs-compatible anchor slug.

    MkDocs/Python-Markdown toc generates anchors by:
    - lowercasing
    - replacing spaces with hyphens
    - stripping non-alphanumeric chars (except hyphens)
    """
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


def build_anchor_index(sections_dir: Path, config: dict) -> dict[str, tuple[str, str]]:
    """Build an index mapping section numbers to (slug, anchor) pairs.

    Returns dict like:
        "4.3.1" -> ("04-identification-measures", "431-finding-out-identity")
        "2"     -> ("02-corporate-governance", "")
    """
    index = {}

    for num, section in sorted(config["sections"].items()):
        slug = section["slug"]
        filepath = sections_dir / f"{slug}.md"

        if not filepath.exists():
            continue

        # Map the top-level section number to the file
        index[str(num)] = (slug, "")

        # Parse headings to find sub-section anchors
        content = filepath.read_text(encoding="utf-8")
        for match in re.finditer(r'^(#{2,6})\s+(\d+(?:\.\d+)+)\s+(.*)', content, re.MULTILINE):
            section_num = match.group(2)  # e.g. "4.3.1"
            heading_text = match.group(3).strip()
            full_heading = f"{section_num} {heading_text}"
            anchor = slugify(full_heading)
            index[section_num] = (slug, anchor)

    return index


def make_link(target_slug: str, target_anchor: str, current_slug: str) -> str:
    """Build a relative markdown link from current file to target.

    If same file: just #anchor
    If different file: slug.md or slug.md#anchor
    """
    if target_slug == current_slug:
        # Same file — use anchor only (or empty for top)
        if target_anchor:
            return f"#{target_anchor}"
        return ""  # Can't link to self with no anchor
    else:
        if target_anchor:
            return f"{target_slug}.md#{target_anchor}"
        return f"{target_slug}.md"


def linkify_references(content: str, anchor_index: dict, current_slug: str) -> str:
    """Replace section references with markdown links.

    Handles patterns like:
    - "Section 4.3.1"
    - "section 4.3.1"
    - "See Section 4.3.1"
    - "Sections 1 to 10"  (skipped — too complex)
    - Already-linked refs "[Section 4.3.1](...)" (skipped)
    """
    def replace_ref(match):
        prefix = match.group(1)  # "Section " or "section "
        sec_num = match.group(2)  # "4.3.1" or "4"

        # Look up in index — try exact match first, then parent sections
        target = anchor_index.get(sec_num)
        if not target:
            # Try without trailing sub-sections (e.g. 4.3.1 -> 4.3 -> 4)
            parts = sec_num.split('.')
            while parts and not target:
                parts.pop()
                if parts:
                    target = anchor_index.get('.'.join(parts))
        if not target:
            return match.group(0)  # No match found, leave as-is

        target_slug, target_anchor = target
        link = make_link(target_slug, target_anchor, current_slug)
        if not link:
            return match.group(0)  # Self-reference with no anchor

        return f"[{prefix}{sec_num}]({link})"

    # Pattern: "Section X.Y.Z" or "section X.Y.Z" — but not already inside a markdown link
    # Negative lookbehind for [ to avoid double-linking
    pattern = r'(?<!\[)((?:[Ss]ection)\s+)(\d+(?:\.\d+)*)'

    # Also skip if followed by ] which means it's already a link text
    result = []
    last_end = 0
    for match in re.finditer(pattern, content):
        start = match.start()
        # Check if this is already inside a markdown link [...](...)
        # Simple heuristic: check if there's a [ before us on the same "word" context
        preceding = content[max(0, start - 1):start]
        if preceding == '[':
            continue

        # Check if followed by ]( which means it's link text
        end = match.end()
        following = content[end:end + 2]
        if following.startswith(']('):
            continue

        result.append(content[last_end:start])
        result.append(replace_ref(match))
        last_end = end

    result.append(content[last_end:])
    return ''.join(result)


def main():
    config = load_config()
    sections_dir = Path(__file__).parent.parent / "site" / "docs" / "sections"

    if not sections_dir.exists():
        print("ERROR: sections/ directory not found. Run normalize.py first.")
        return

    print("=== Building Cross-References ===")

    # Step 1: Build anchor index from all section headings
    anchor_index = build_anchor_index(sections_dir, config)
    print(f"  Indexed {len(anchor_index)} section anchors")

    # Step 2: Replace references in each section file
    total_links = 0
    for num, section in sorted(config["sections"].items()):
        filepath = sections_dir / f"{section['slug']}.md"
        if not filepath.exists():
            continue

        content = filepath.read_text(encoding="utf-8")
        updated = linkify_references(content, anchor_index, section['slug'])

        # Count how many links were added by counting [Section ...](...) patterns
        new_links = len(re.findall(r'\[[Ss]ection\s+\d+[^]]*\]\(', updated)) - \
                    len(re.findall(r'\[[Ss]ection\s+\d+[^]]*\]\(', content))
        if new_links > 0:
            filepath.write_text(updated, encoding="utf-8")
            print(f"  [crossref] Section {num}: {new_links} links added")
            total_links += new_links
        else:
            print(f"  [crossref] Section {num}: no new links")

    print(f"\n  Total cross-reference links added: {total_links}")


if __name__ == "__main__":
    main()
