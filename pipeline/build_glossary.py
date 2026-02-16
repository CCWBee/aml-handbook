"""Build glossary page and abbreviations.md from the JFSC glossary PDF."""

import re
import sys
from pathlib import Path

import yaml


def load_config():
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def parse_glossary_markdown(md: str) -> list[tuple[str, str]]:
    """Parse raw glossary markdown into (term, definition) pairs.

    The JFSC glossary is in markdown table format:
    | Term | Definition |
    |------|------------|
    | AML  | Anti-money laundering. |
    """
    entries = []

    # Pattern: Markdown table rows "| term | definition |"
    # Skip header rows (containing "Term" or separator rows with dashes)
    for line in md.split("\n"):
        line = line.strip()
        if not line.startswith("|"):
            continue

        # Split by pipe
        cells = [c.strip() for c in line.split("|")]
        # Filter empty strings from leading/trailing pipes
        cells = [c for c in cells if c]

        if len(cells) < 2:
            continue

        term = cells[0].strip()
        defn = cells[1].strip()

        # Skip header rows and separator rows
        if term.lower() == "term" or re.match(r'^[-:]+$', term):
            continue
        if re.match(r'^[-:]+$', defn):
            continue

        # Skip empty entries
        if not term or not defn:
            continue

        # Clean up whitespace in definition
        defn = re.sub(r'\s+', ' ', defn).strip()

        # --- Data quality fixes ---

        # Strip leading parenthetical prefix: "(the) Minister" → "Minister"
        term = re.sub(r'^\(.*?\)\s*', '', term).strip()

        # Skip entries where term is only punctuation or whitespace
        if not term or re.match(r'^[\W_]+$', term):
            continue

        # Skip entries where definition is too short (< 15 chars) or starts with ›
        if len(defn) < 15 or defn.startswith('›'):
            continue

        # Skip overly generic single-word terms that cause false tooltip matches
        BLOCKED_TERMS = {'financing', 'terrorist', 'terrorism', 'person', 'business',
                         'order', 'law', 'risk', 'fund', 'service', 'trust'}
        if term.lower() in BLOCKED_TERMS:
            continue

        entries.append((term, defn))

    # Deduplicate (same term may appear across multiple tables)
    seen = {}
    for term, defn in entries:
        if term not in seen:
            seen[term] = defn

    return list(seen.items())


def generate_abbreviations_md(entries: list[tuple[str, str]]) -> str:
    """Generate MkDocs abbreviations.md for auto-tooltips.

    Skips 1-2 character abbreviations to avoid false-positive tooltip noise
    (e.g. EU, UN, UK, VA match too many unrelated words in content).
    These short terms still appear on the glossary page.
    """
    lines = []
    for term, defn in sorted(entries, key=lambda x: x[0].lower()):
        # Skip very short abbreviations — too many false-positive matches
        if len(term) <= 2:
            continue
        # MkDocs abbr format: *[TERM]: Definition
        # Clean definition to single line
        clean_def = re.sub(r'\s+', ' ', defn).strip()
        # Truncate long definitions for tooltips
        if len(clean_def) > 200:
            clean_def = clean_def[:197] + "..."
        lines.append(f"*[{term}]: {clean_def}")
    return "\n".join(lines) + "\n"


def generate_glossary_page(entries: list[tuple[str, str]]) -> str:
    """Generate a readable glossary.md page."""
    lines = [
        "---",
        "title: 'Glossary'",
        "---",
        "",
        "# Glossary",
        "",
        "Terms and definitions used throughout the AML/CFT/CPF Handbook.",
        "",
    ]

    # Group by first letter (use first alphanumeric character for sorting)
    current_letter = ""
    for term, defn in sorted(entries, key=lambda x: x[0].upper()):
        # Use first alphanumeric char for grouping
        first = next((c.upper() for c in term if c.isalpha()), term[0].upper())
        if first != current_letter:
            current_letter = first
            lines.append(f"## {current_letter}")
            lines.append("")

        clean_def = re.sub(r'\s+', ' ', defn).strip()
        lines.append(f"**{term}**")
        lines.append(f":   {clean_def}")
        lines.append("")

    return "\n".join(lines)


def main():
    config = load_config()
    raw_dir = Path(__file__).parent / "raw"
    includes_dir = Path(__file__).parent.parent / "site" / "includes"
    docs_dir = Path(__file__).parent.parent / "site" / "docs"
    includes_dir.mkdir(parents=True, exist_ok=True)

    glossary_raw = raw_dir / "glossary.md"

    if not glossary_raw.exists():
        print("[WARN] glossary.md not found in raw/. Creating placeholder files.")
        # Create minimal placeholder files so the site still builds
        (includes_dir / "abbreviations.md").write_text(
            "*[AML]: Anti-Money Laundering\n"
            "*[CFT]: Countering the Financing of Terrorism\n"
            "*[CPF]: Countering Proliferation Financing\n"
            "*[CDD]: Customer Due Diligence\n"
            "*[EDD]: Enhanced Due Diligence\n"
            "*[SDD]: Simplified Due Diligence\n"
            "*[SAR]: Suspicious Activity Report\n"
            "*[JFSC]: Jersey Financial Services Commission\n"
            "*[PEP]: Politically Exposed Person\n"
            "*[TCSP]: Trust and Company Service Provider\n"
            "*[KYC]: Know Your Customer\n"
            "*[MLO]: Money Laundering Offence\n"
            "*[MLCO]: Money Laundering Compliance Officer\n"
            "*[MLRO]: Money Laundering Reporting Officer\n"
            "*[FT]: Financing of Terrorism\n"
            "*[PF]: Proliferation Financing\n"
            "*[UBO]: Ultimate Beneficial Owner\n"
            "*[NPO]: Non-Profit Organisation\n",
            encoding="utf-8"
        )
        (docs_dir / "glossary.md").write_text(
            "---\ntitle: 'Glossary'\n---\n\n# Glossary\n\n"
            "Glossary will be populated from the JFSC glossary PDF.\n",
            encoding="utf-8"
        )
        return

    print("=== Building Glossary ===")
    raw_md = glossary_raw.read_text(encoding="utf-8")
    entries = parse_glossary_markdown(raw_md)
    print(f"  Parsed {len(entries)} glossary entries")

    if not entries:
        print("  [WARN] No entries parsed. Check glossary format.")
        # Still create files with common abbreviations
        entries = [
            ("AML", "Anti-Money Laundering"),
            ("CFT", "Countering the Financing of Terrorism"),
            ("CPF", "Countering Proliferation Financing"),
            ("CDD", "Customer Due Diligence"),
            ("EDD", "Enhanced Due Diligence"),
            ("SAR", "Suspicious Activity Report"),
            ("JFSC", "Jersey Financial Services Commission"),
            ("PEP", "Politically Exposed Person"),
        ]

    # Write abbreviations.md for auto-tooltips
    abbrev_path = includes_dir / "abbreviations.md"
    abbrev_content = generate_abbreviations_md(entries)
    abbrev_path.write_text(abbrev_content, encoding="utf-8")
    print(f"  [ok] abbreviations.md ({len(entries)} entries)")

    # Write glossary.md page
    glossary_path = docs_dir / "glossary.md"
    glossary_content = generate_glossary_page(entries)
    glossary_path.write_text(glossary_content, encoding="utf-8")
    print(f"  [ok] glossary.md")


if __name__ == "__main__":
    main()
