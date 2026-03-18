"""
Snapshot current handbook content as a versioned clause archive.

Runs extract_clauses on all 18 sections and writes structured JSON
to the versions directory for use by the comparison UI.
"""

import json
import sys
from pathlib import Path
from datetime import date

from extract_clauses import extract_section

SECTIONS_DIR = Path(__file__).parent.parent / "site" / "docs" / "sections"
VERSIONS_DIR = Path(__file__).parent.parent / "site" / "docs" / "versions"

SECTION_TITLES = {
    1: "Section 1 - Introduction",
    2: "Section 2 - Corporate Governance",
    3: "Section 3 - Identification Measures - Overview",
    4: "Section 4 - Identification Measures",
    5: "Section 5 - Reliance on Obliged Persons",
    6: "Section 6 - Ongoing Monitoring",
    7: "Section 7 - Enhanced and Simplified CDD",
    8: "Section 8 - Reporting Obligations",
    9: "Section 9 - Screening, Awareness and Training",
    10: "Section 10 - Record Keeping",
    11: "Section 11 - Wire Transfers",
    12: "Section 12 - Trust Company Business",
    13: "Section 13 - Fund and Security Services",
    14: "Section 14 - Estate Agents and HVDs",
    15: "Section 15 - Lawyers",
    16: "Section 16 - Accountants",
    17: "Section 17 - Prescribed NPOs",
    18: "Section 18 - AML Service Providers",
}


def snapshot(version_id, label=None):
    """Create a versioned snapshot of all sections."""
    if label is None:
        label = version_id

    version_dir = VERSIONS_DIR / version_id
    version_dir.mkdir(parents=True, exist_ok=True)

    total_clauses = 0
    section_files = sorted(SECTIONS_DIR.glob("*.md"))

    for md_file in section_files:
        result = extract_section(md_file)
        section_num = result['section']
        result['sectionTitle'] = SECTION_TITLES.get(section_num, md_file.stem)
        result['versionId'] = version_id

        out_path = version_dir / f"{md_file.stem}.json"
        out_path.write_text(
            json.dumps(result, indent=2, ensure_ascii=False),
            encoding='utf-8'
        )

        clause_count = len(result['clauses'])
        total_clauses += clause_count
        print(f"  {md_file.stem}: {clause_count} clauses")

    # Write/update manifest
    manifest_path = VERSIONS_DIR / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    else:
        manifest = {"versions": [], "current": None}

    # Check if version already exists
    existing = [v for v in manifest['versions'] if v['id'] == version_id]
    if not existing:
        manifest['versions'].append({
            "id": version_id,
            "label": label,
            "date": version_id,
            "baseline": len(manifest['versions']) == 0,
        })

    manifest['current'] = version_id
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )

    print(f"\nSnapshot complete: {version_id}")
    print(f"  {len(section_files)} sections, {total_clauses} total clauses")
    print(f"  Output: {version_dir}")
    print(f"  Manifest: {manifest_path}")


if __name__ == '__main__':
    vid = sys.argv[1] if len(sys.argv) > 1 else date.today().isoformat()
    lbl = sys.argv[2] if len(sys.argv) > 2 else None
    snapshot(vid, lbl)
