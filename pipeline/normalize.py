"""Normalize raw Docling markdown into MkDocs-ready pages.

Uses structural heading markers from the PDF (Statutory requirements,
AML/CFT/CPF Codes of Practice, Guidance notes) to classify content
and wrap it in appropriate admonitions.

JFSC Handbook colour key (from the JFSC website):
  Section heading     → Blue      (all supervised persons)
  Sub heading         → Grey      (all supervised persons)
  Statutory requirements → Light blue (mandatory)
  AML/CFT/CPF Codes of Practice → Magenta (mandatory)
  Guidance notes      → Green     (guidance)
"""

import re
import sys
from pathlib import Path

import yaml


def load_config():
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


# Structural heading patterns that indicate content type
# These appear as ## headings in the Docling markdown output
CONTENT_TYPE_HEADINGS = {
    "statutory": "statutory",
    "codes of practice": "code",
    "code of practice": "code",
    "guidance note": "guidance",
    "overview": "overview",
}


def classify_heading(text: str) -> str | None:
    """Check if a heading is a content-type marker."""
    lower = text.lower().strip()
    for pattern, content_type in CONTENT_TYPE_HEADINGS.items():
        if pattern in lower:
            return content_type
    return None


def wrap_in_admonition(text: str, content_type: str) -> str:
    """Wrap text in an MkDocs admonition based on content type."""
    if content_type == "statutory":
        title = "Statutory Requirement"
        kind = "danger"
    elif content_type == "code":
        title = "AML/CFT/CPF Code of Practice"
        kind = "warning"
    elif content_type == "guidance":
        title = "Guidance"
        kind = "info"
    else:
        return text

    # Indent all lines for the admonition body
    indented = _indent(text)
    return f'!!! {kind} "{title}"\n\n{indented}\n'


def _indent(text: str, spaces: int = 4) -> str:
    """Indent all lines of text."""
    prefix = " " * spaces
    lines = text.split("\n")
    return "\n".join(prefix + line if line.strip() else "" for line in lines)


def clean_markdown(md: str) -> str:
    """Clean up common Docling markdown artifacts."""
    # Remove excessive blank lines
    md = re.sub(r'\n{4,}', '\n\n\n', md)

    # Fix broken heading lines (e.g. "##Section" → "## Section")
    md = re.sub(r'^(#{1,6})([^ #\n])', r'\1 \2', md, flags=re.MULTILINE)

    # Remove repeated header/footer lines
    md = re.sub(
        r'^Handbook for the prevention and detection of money laundering.*$',
        '', md, flags=re.MULTILINE
    )
    md = re.sub(
        r'^and the countering of proliferation financing\s*$',
        '', md, flags=re.MULTILINE
    )

    # Remove page number lines like "42 This version is effective from..."
    md = re.sub(r'^\d+\s+This version is effective from:.*$', '', md, flags=re.MULTILINE)

    # Remove image placeholders (including inline occurrences)
    md = re.sub(r'<!-- image -->', '', md)

    # Clean up leftover formatting artifacts
    md = re.sub(r'\*\*\s*\*\*', '', md)  # Empty bold
    md = re.sub(r'_\s*_', '', md)  # Empty italic

    # --- Fix broken words from OCR/Docling ---
    # Common pattern: space inserted before trailing 's' (plural)
    md = re.sub(r'\b(person|customer|supervised person|obliged person|employee) s\b',
                r'\1s', md)
    # Possessive with space before apostrophe: "person 's" → "person's"
    md = re.sub(r"\b(person|customer|supervised person|obliged person|employee|Law) 's\b",
                r"\1's", md)
    # Acronym plurals with space: "NPO s" → "NPOs", "MLRO s" → "MLROs"
    md = re.sub(r'\b(NPO|MLRO|MLCO|AMLSP|Deputy MLRO) s\b', r'\1s', md)
    # Specific broken words found in the corpus
    broken_words = {
        r'\bb oard\b': 'board',
        r'\bacc ount\b': 'account',
        r'\bbra nch\b': 'branch',
        r'\bpro liferation\b': 'proliferation',
        r'\bsup ervised\b': 'supervised',
        r'\btrans action\b': 'transaction',
        r'\brelation ship\b': 'relationship',
        r'\bterror ism\b': 'terrorism',
        r'\blaunder ing\b': 'laundering',
        r'\bfinanc ing\b': 'financing',
        r'\bregulat ion\b': 'regulation',
        r'\blegislat ion\b': 'legislation',
        r'\bident ification\b': 'identification',
        r'\brequ irement\b': 'requirement',
        r'\bobligat ion\b': 'obligation',
        r'\binformat ion\b': 'information',
        r'\bt he\b': 'the',
        r'\bOr der\b': 'Order',
        r'\bG uidance\b': 'Guidance',
        r'\bs tatutory\b': 'statutory',
        r'\brelationship s\b': 'relationships',
    }
    for pattern, replacement in broken_words.items():
        md = re.sub(pattern, replacement, md, flags=re.IGNORECASE)

    # Collapse double spaces to single within text (common OCR artifact)
    # Only mid-line, preserve leading indentation
    md = re.sub(r'(?<=\S)  +', ' ', md)

    # Fix space before punctuation (but not inside markdown links/URLs)
    md = re.sub(r'(?<!\w://)(?<!\() ([.,;:])', r'\1', md)

    # Collapse duplicate adjacent paragraphs (OCR overlap artifacts)
    lines = md.split('\n')
    deduped = []
    prev_line = None
    for line in lines:
        stripped = line.strip()
        if stripped and stripped == prev_line:
            continue  # Skip exact duplicate of previous non-empty line
        deduped.append(line)
        if stripped:
            prev_line = stripped
        # Reset on blank lines to only dedupe within the same block
        if not stripped:
            prev_line = None
    md = '\n'.join(deduped)

    # Remove excessive blank lines again after cleanup
    md = re.sub(r'\n{3,}', '\n\n', md)

    return md.strip()


def fix_clause_structure(md: str) -> str:
    """Transform Docling's flat bullet format into proper clause paragraphs + lists.

    Docling converts PDF numbered paragraphs and sub-bullets into flat markdown
    bullet points.  This restructures them:

      - ``- N. text``  (numbered clause)  →  ``**N.** text``  (paragraph)
      - ``- › text`` / ``- · text`` / ``- o text``  (sub-bullets)  →  ``- text``
      - ``- a. text``  (lettered sub-item)  →  ``- (a) text``
      - ``- i) text``  (roman numeral sub-item)  →  ``- (i) text``

    Blank lines are inserted at type transitions so that the markdown block
    splitter in normalize_section() produces correct paragraphs and lists.
    """
    # Line-type classifiers (order matters: more specific first)
    _RE_CLAUSE  = re.compile(r'^- (\d+)\.\s+(.+)$')
    _RE_BULLET  = re.compile(r'^- [›·]\s*(.+)$')
    _RE_OBULLET = re.compile(r'^- o ([A-Za-z].+)$')        # 'o' as bullet char
    _RE_LETTER  = re.compile(r'^- ([a-z])\.\s+(.+)$')
    _RE_ROMAN   = re.compile(r'^- ([ivxlc]+)\)\s*(.+)$')  # i), ii), iii), iv)

    lines = md.split('\n')
    output: list[str] = []
    prev_type = 'blank'  # clause | bullet | blank | other

    for line in lines:
        stripped = line.strip()

        # Blank line
        if not stripped:
            output.append('')
            prev_type = 'blank'
            continue

        # --- Numbered clause: "- N. text" → "**N.** text" ---
        m = _RE_CLAUSE.match(stripped)
        if m:
            num, text = m.groups()
            if prev_type in ('bullet', 'clause'):
                output.append('')
            output.append(f'**{num}.** {text}')
            prev_type = 'clause'
            continue

        # --- Sub-bullet: "- › text", "- · text" ---
        m = _RE_BULLET.match(stripped)
        if m:
            text = m.group(1)
            if prev_type == 'clause':
                output.append('')
            output.append(f'- {text}')
            prev_type = 'bullet'
            continue

        # --- o-bullet: "- o Text" (o is a bullet character, not a letter) ---
        m = _RE_OBULLET.match(stripped)
        if m:
            text = m.group(1)
            if prev_type == 'clause':
                output.append('')
            output.append(f'- {text}')
            prev_type = 'bullet'
            continue

        # --- Roman numeral: "- i) text", "- ii) text" ---
        m = _RE_ROMAN.match(stripped)
        if m:
            numeral, text = m.groups()
            if prev_type == 'clause':
                output.append('')
            output.append(f'- ({numeral}) {text}')
            prev_type = 'bullet'
            continue

        # --- Lettered sub-item: "- a. text" ---
        m = _RE_LETTER.match(stripped)
        if m:
            letter, text = m.groups()
            if prev_type == 'clause':
                output.append('')
            output.append(f'- ({letter}) {text}')
            prev_type = 'bullet'
            continue

        # --- Anything else (headings, plain text, tables, etc.) ---
        if prev_type == 'bullet':
            output.append('')
        output.append(line)
        prev_type = 'other'

    return '\n'.join(output)


def generate_frontmatter(section_num: int, section_config: dict) -> str:
    """Generate YAML frontmatter for a section page."""
    roles = section_config["roles"]
    title = section_config["title"]

    lines = [
        "---",
        f'title: "Section {section_num} - {title}"',
        f"section: {section_num}",
        "roles:",
    ]
    for role in roles:
        lines.append(f"  - {role}")
    lines.append("tags:")
    lines.append(f"  - section-{section_num}")
    lines.append("---")

    return "\n".join(lines)


def normalize_section(raw_md: str, section_num: int, section_config: dict) -> str:
    """Produce final MkDocs-ready markdown using structural heading markers."""
    md = clean_markdown(raw_md)
    md = fix_clause_structure(md)

    # Split into blocks (separated by blank lines)
    blocks = re.split(r'\n\n+', md)

    output_parts = []
    current_content_type = None  # Track what content type we're in
    pending_paragraphs = []  # Accumulate paragraphs for current admonition

    def flush_pending():
        """Flush accumulated paragraphs as an admonition or plain text."""
        nonlocal pending_paragraphs, current_content_type
        if not pending_paragraphs:
            return

        combined = "\n\n".join(pending_paragraphs)
        if current_content_type and current_content_type != "overview":
            output_parts.append(wrap_in_admonition(combined, current_content_type))
        else:
            output_parts.append(combined)
        pending_paragraphs = []

    for block in blocks:
        stripped = block.strip()
        if not stripped:
            continue

        # Check if this is a heading
        heading_match = re.match(r'^(#{1,6})\s+(.*)', stripped)
        if heading_match:
            hashes = heading_match.group(1)
            heading_text = heading_match.group(2).strip()
            level = len(hashes)

            # Check if it's a content-type structural marker
            ct = classify_heading(heading_text)
            if ct is not None:
                # Flush previous content type
                flush_pending()
                current_content_type = ct
                # Don't output the structural heading itself - the admonition title replaces it
                continue

            # Regular heading - flush pending and reset content type
            flush_pending()
            current_content_type = None

            # Determine heading level from section number depth
            # e.g. "1" → h2, "1.1" → h3, "1.4.1" → h4, "1.4.1.1" → h5
            sec_num_match = re.match(r'^(\d+(?:\.\d+)*)\s', heading_text)
            if sec_num_match:
                depth = sec_num_match.group(1).count('.') + 1
                level = depth + 1  # h1 reserved for page title

                # Skip the top-level section heading (e.g. "2 CORPORATE GOVERNANCE")
                # since the page h1 already has "Section 2 - Corporate Governance"
                if depth == 1 and sec_num_match.group(1) == str(section_num):
                    continue
            elif level < 2:
                level = 2

            output_parts.append(f"{'#' * level} {heading_text}")
            continue

        # Don't wrap tables
        if stripped.startswith("|"):
            flush_pending()
            output_parts.append(stripped)
            continue

        # Don't wrap code blocks
        if stripped.startswith("```"):
            flush_pending()
            output_parts.append(stripped)
            continue

        # Accumulate paragraph under current content type
        if current_content_type:
            pending_paragraphs.append(stripped)
        else:
            output_parts.append(stripped)

    # Flush any remaining
    flush_pending()

    # Assemble final document
    frontmatter = generate_frontmatter(section_num, section_config)
    title = f"# Section {section_num} - {section_config['title']}"
    body = "\n\n".join(output_parts)

    return f"{frontmatter}\n\n{title}\n\n{body}\n"


def main():
    config = load_config()
    raw_dir = Path(__file__).parent / "raw"
    docs_dir = Path(__file__).parent.parent / "site" / "docs" / "sections"
    docs_dir.mkdir(parents=True, exist_ok=True)

    if not raw_dir.exists():
        print("ERROR: raw/ directory not found. Run ingest.py first.")
        sys.exit(1)

    print("=== Normalizing Sections ===")
    for num, section in sorted(config["sections"].items()):
        raw_file = raw_dir / f"{section['slug']}.md"
        out_file = docs_dir / f"{section['slug']}.md"

        if not raw_file.exists():
            print(f"  [WARN] {raw_file.name} not found, skipping")
            continue

        print(f"  [normalize] Section {num}: {section['title']}")

        raw_md = raw_file.read_text(encoding="utf-8")
        result = normalize_section(raw_md, num, section)
        out_file.write_text(result, encoding="utf-8")

        # Count admonitions for verification
        stat_count = result.count('"Statutory Requirement"')
        code_count = result.count('"AML/CFT/CPF Code of Practice"')
        guid_count = result.count('"Guidance"')
        print(f"    Statutory: {stat_count}, Codes: {code_count}, Guidance: {guid_count}")

    # Also handle appendices
    print("\n=== Normalizing Extras ===")
    appendix_dir = Path(__file__).parent.parent / "site" / "docs" / "appendices"
    appendix_dir.mkdir(parents=True, exist_ok=True)

    for key, extra in config.get("extras", {}).items():
        if key == "glossary":
            continue  # Handled by build_glossary.py

        raw_file = raw_dir / f"{extra['output']}.md"
        out_file = appendix_dir / f"{extra['output']}.md"

        if not raw_file.exists():
            print(f"  [WARN] {raw_file.name} not found, skipping")
            continue

        print(f"  [normalize] {extra['title']}")
        raw_md = raw_file.read_text(encoding="utf-8")
        md = clean_markdown(raw_md)

        frontmatter = f'---\ntitle: "{extra["title"]}"\n---'
        result = f"{frontmatter}\n\n# {extra['title']}\n\n{md}\n"
        out_file.write_text(result, encoding="utf-8")
        print(f"  [ok] {out_file.name}")


if __name__ == "__main__":
    main()
