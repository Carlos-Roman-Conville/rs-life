#!/usr/bin/env python3
"""Validate a plants.json species table. Usage: check_plants.py TABLE [--filled]"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLANTS = ROOT / "data" / "library" / "plants.json"
VALIDATION = ROOT / "data" / "library" / "validation" / "plants_validation.json"
FLAGS = ROOT / "flags" / "plants.md"
LABELS = frozenset({"researched", "estimate", "fiction"})

SPECIES_TAGS = {
    "swietenia_mahagoni": {"tree"},
    "saccharum_officinarum": {"crop"},
    "rhizophora_mangle": {"tree", "mangrove"},
    "thalassia_testudinum": {"seagrass"},
}


def applies_to_species(applies: str, tags: set[str]) -> bool:
    parts = {p.strip() for p in applies.split(",")}
    if "all" in parts:
        return True
    return bool(tags & parts)


def col_index(cols: list, name: str) -> int:
    return cols.index(name)


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--filled"]
    filled = "--filled" in sys.argv[1:]
    if len(args) != 1:
        print("usage: check_plants.py TABLE [--filled]", file=sys.stderr)
        return 1
    table = args[0]
    problems: list[str] = []

    doc = json.loads(PLANTS.read_text(encoding="utf-8"))
    if table not in doc or table.startswith("_") or table == "schema":
        problems.append(f"unknown table {table!r}")
        for p in problems:
            print(p)
        return 1

    schema = doc["schema"]
    scols = schema["columns"]
    si = col_index(scols, "Field")
    ai = col_index(scols, "Applies to")
    expected_fields: set[str] = set()
    field_applies: dict[str, str] = {}
    for row in schema["rows"]:
        field = row[si]
        field_applies[field] = row[ai]
        if table == "schema":
            continue
        tags = SPECIES_TAGS.get(table, set())
        if applies_to_species(row[ai], tags):
            expected_fields.add(field)

    t = doc[table]
    cols = t["columns"]
    fi = col_index(cols, "Field")
    vi = col_index(cols, "Value")
    li = col_index(cols, "Label")
    ei = col_index(cols, "Evidence")
    ni = col_index(cols, "Note")
    ui = col_index(cols, "URL")
    idi = col_index(cols, "id")

    seen: set[str] = set()
    urls: set[str] = set()
    for row in t["rows"]:
        field = row[fi]
        rid = row[idi]
        if field in seen:
            problems.append(f"duplicate field {field!r}")
        seen.add(field)
        if field not in expected_fields:
            problems.append(f"unexpected row for field {field!r}")
        val = row[vi]
        if val is not None:
            label = row[li]
            if label not in LABELS:
                problems.append(f"{rid}: Value set but Label {label!r} not researched, estimate, or fiction")
            ev = row[ei]
            if ev is None or not (1 <= int(ev) <= 6):
                problems.append(f"{rid}: Value set but Evidence must be 1..6")
            if label == "researched":
                if not row[ui]:
                    problems.append(f"{rid}: researched Value needs URL")
            elif label == "estimate":
                note = row[ni]
                if not note or not str(note).strip():
                    problems.append(f"{rid}: estimate Value needs Note basis")
        elif filled:
            flags_text = FLAGS.read_text(encoding="utf-8") if FLAGS.exists() else ""
            if not any(rid in line and "searched:" in line for line in flags_text.splitlines()):
                problems.append(f"{rid}: null Value needs flags/plants.md line with searched:")
        if row[ui]:
            urls.add(str(row[ui]))

    for field in sorted(expected_fields - seen):
        problems.append(f"missing row for field {field!r}")

    pv = json.loads(VALIDATION.read_text(encoding="utf-8"))
    if pv:
        vcols = pv["columns"]
        vidi = col_index(vcols, "id")
        vui = col_index(vcols, "URL")
        prefix = f"validation.plants_validation.{table}."
        for row in pv["rows"]:
            rid = row[vidi]
            if not str(rid).startswith(prefix):
                continue
            url = row[vui]
            if url and str(url) in urls:
                problems.append(f"{url} is a validation URL but also cited on {table}")

    for p in problems:
        print(p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
