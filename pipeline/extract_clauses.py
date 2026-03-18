"""
Extract numbered clauses from handbook section markdown files.

Parses each section into structured JSON with clause number, text,
admonition type, heading context, and list items.
"""

import json
import re
import sys
from pathlib import Path

# Matches: **1.** or **12.** at start of line (with optional leading whitespace)
CLAUSE_RE = re.compile(r'^(\s*)\*\*(\d+)\.\*\*\s*(.*)')
HEADING_RE = re.compile(r'^(#{2,4})\s+(.*)')
ADMONITION_RE = re.compile(r'^!!!\s+(danger|warning|info)\s+"([^"]*)"')
LIST_ITEM_RE = re.compile(r'^(\s*)[-*]\s+(.*)')
FRONTMATTER_RE = re.compile(r'^---\s*$')

ADMONITION_MAP = {
    'danger': 'statutory',
    'warning': 'code',
    'info': 'guidance',
}


def extract_clauses(markdown_text):
    """Parse markdown into a list of clause dicts."""
    lines = markdown_text.split('\n')
    clauses = []

    # State
    current_heading = None
    current_admonition = None
    in_frontmatter = False
    frontmatter_seen = False
    in_admonition_block = False
    admonition_indent = 0

    # Current clause being built
    current_clause = None

    def flush_clause():
        nonlocal current_clause
        if current_clause:
            # Clean up text
            current_clause['text'] = ' '.join(current_clause['text'].split()).strip()
            # Clean up list items
            current_clause['listItems'] = [
                ' '.join(item.split()).strip()
                for item in current_clause['listItems']
                if item.strip()
            ]
            clauses.append(current_clause)
            current_clause = None

    i = 0
    while i < len(lines):
        line = lines[i]

        # Handle YAML frontmatter
        if FRONTMATTER_RE.match(line):
            if not frontmatter_seen:
                in_frontmatter = True
                frontmatter_seen = True
                i += 1
                continue
            elif in_frontmatter:
                in_frontmatter = False
                i += 1
                continue
        if in_frontmatter:
            i += 1
            continue

        # Check for heading
        heading_match = HEADING_RE.match(line)
        if heading_match:
            flush_clause()
            current_heading = heading_match.group(2).strip()
            # Headings break admonition context if at top level
            if not line.startswith('    '):
                in_admonition_block = False
                current_admonition = None
            i += 1
            continue

        # Check for admonition opener
        admonition_match = ADMONITION_RE.match(line)
        if admonition_match:
            flush_clause()
            adm_type = admonition_match.group(1)
            current_admonition = ADMONITION_MAP.get(adm_type, adm_type)
            in_admonition_block = True
            admonition_indent = 4
            i += 1
            continue

        # Check for clause start
        clause_match = CLAUSE_RE.match(line)
        if clause_match:
            flush_clause()
            indent = len(clause_match.group(1))
            num = int(clause_match.group(2))
            rest = clause_match.group(3).strip()

            # Determine admonition context
            adm = None
            if indent >= 4 and in_admonition_block:
                adm = current_admonition
            elif indent == 0:
                # Top-level clause exits any admonition context
                in_admonition_block = False
                current_admonition = None

            current_clause = {
                'num': num,
                'admonition': adm,
                'heading': current_heading,
                'text': rest,
                'listItems': [],
            }
            i += 1
            continue

        # If we're building a clause, collect continuation lines
        if current_clause:
            stripped = line.strip()

            # Blank line - might be paragraph break within clause
            if not stripped:
                i += 1
                continue

            # Check if this is a list item belonging to the clause
            list_match = LIST_ITEM_RE.match(line)
            if list_match:
                current_clause['listItems'].append(list_match.group(2).strip())
                i += 1
                continue

            # Check if this is a sub-list item (indented further, e.g. (a), (b))
            if stripped.startswith('(') or stripped.startswith('-'):
                current_clause['listItems'].append(stripped)
                i += 1
                continue

            # Otherwise it's continuation text
            # But check it's not a new structural element
            if HEADING_RE.match(line) or ADMONITION_RE.match(line) or CLAUSE_RE.match(line):
                # Don't consume - let the outer loop handle it
                continue

            current_clause['text'] += ' ' + stripped

        i += 1

    # Flush the last clause
    flush_clause()

    return clauses


def extract_section(filepath):
    """Extract clauses from a section markdown file."""
    path = Path(filepath)
    text = path.read_text(encoding='utf-8')

    # Get section number from filename
    match = re.match(r'(\d+)', path.stem)
    section_num = int(match.group(1)) if match else 0

    clauses = extract_clauses(text)

    return {
        'section': section_num,
        'sectionTitle': None,  # filled by snapshot script
        'clauses': clauses,
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python extract_clauses.py <section.md> [--json]")
        sys.exit(1)

    filepath = sys.argv[1]
    result = extract_section(filepath)

    if '--json' in sys.argv:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(f"Section {result['section']}: {len(result['clauses'])} clauses extracted")
        for c in result['clauses'][:5]:
            adm = f" [{c['admonition']}]" if c['admonition'] else ""
            heading = f" ({c['heading']})" if c['heading'] else ""
            text_preview = c['text'][:80] + '...' if len(c['text']) > 80 else c['text']
            print(f"  §{c['num']}{adm}{heading}: {text_preview}")
        if len(result['clauses']) > 5:
            print(f"  ... and {len(result['clauses']) - 5} more")
