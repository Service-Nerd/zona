#!/usr/bin/env python3
"""PostToolUse: flag open backlog items whose files this commit just touched.

The problem this solves: the existing /ship prompt asks "did this commit ship a
tracked backlog item?" — which only catches items you SET OUT to close. It misses
items closed *incidentally* by a broad sweep. PUSH-UNITS-01 was fixed by the
ADR-015 Phase-2 pass and then sat open in the backlog for weeks, because the
refactor commit didn't obviously map to a narrow backlog ID.

So this asks a different, mechanical question: which open backlog entries NAME a
file that this commit changed? Backlog entries cite their files
(`lib/coaching/voiceLines.ts`, `app/api/push/send-daily/route.ts`), so the match
is a grep, not a judgement.

Deliberately reports possible matches rather than deciding. A touched file means
"go and check that entry", not "this shipped" — a commit can touch voiceLines.ts
without closing anything.

Handles all THREE backlog item formats (the 2026-08-15 audit found a bullet-only
grep silently misses ~40% of open items):
  1. `- 🔲/🔄/⛔ **[W6]** **ID — ...`   status bullets
  2. `| **CA-08** · **[W4]** | ...`      LATER table rows
  3. `- **[W5]** **Title** — ...`        scoped-but-unscheduled bullets

Contract: reads the PostToolUse payload on stdin, exits 0 always (advisory only).
"""
import json
import os
import re
import subprocess
import sys

BACKLOG = 'docs/releases/backlog.md'

# A line that STARTS a backlog item, in any of the three formats.
ITEM_START = re.compile(
    r'^(?:'
    r'-\s+(?:🔲|🔄|⛔|✅)'          # status bullet
    r'|\|\s*\*\*[^|*]+\*\*'          # table row
    r'|-\s+\*\*\[W\d\]\*\*'          # unscheduled bullet
    r')'
)
# Headings end the current item's continuation block.
HEADING = re.compile(r'^#{2,4}\s')
SHIPPED = re.compile(r'✅|~~')

# Paths inside backticks. Extension-anchored so prose doesn't produce noise.
PATH_RE = re.compile(r'`([A-Za-z0-9_./@{},\-]+\.(?:ts|tsx|js|mjs|sql|css|json|md))`')
# `lib/coaching/prompts/{a,b,c}.ts` — brace lists appear in real entries.
BRACE_RE = re.compile(r'^(.*?)\{([^}]*)\}(.*)$')

# A short label for the item: prefer an ALL-CAPS ID, else the first bold phrase.
# The ID usually opens a bold run and is followed by an em-dash and the title
# (`**PUSH-UNITS-01 — daily push must ...**`), so do NOT require a closing `**`.
ID_RE = re.compile(r'\*\*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b')
BOLD_RE = re.compile(r'\*\*(.+?)\*\*')


def expand_braces(path: str):
    m = BRACE_RE.match(path)
    if not m:
        return [path]
    head, body, tail = m.groups()
    return [p for opt in body.split(',') for p in expand_braces(head + opt.strip() + tail)]


def label_for(text: str) -> str:
    m = ID_RE.search(text)
    if m:
        return m.group(1)
    for cand in BOLD_RE.findall(text):
        cand = cand.strip()
        if cand and not cand.startswith('[W'):
            return (cand[:60] + '…') if len(cand) > 60 else cand
    return 'unlabelled item'


def parse_items(md: str):
    """-> list of (label, set_of_paths) for items not marked shipped."""
    items, cur = [], None
    for line in md.split('\n'):
        if HEADING.match(line):
            if cur:
                items.append(cur)
                cur = None
            continue
        if ITEM_START.match(line):
            if cur:
                items.append(cur)
            cur = {'label': label_for(line), 'text': line, 'shipped': bool(SHIPPED.search(line))}
        elif cur is not None and line.strip():
            cur['text'] += '\n' + line          # continuation / sub-bullet
    if cur:
        items.append(cur)

    out = []
    for it in items:
        if it['shipped']:
            continue
        paths = set()
        for raw in PATH_RE.findall(it['text']):
            for p in expand_braces(raw):
                paths.add(p.strip('/'))
        if paths:
            out.append((it['label'], paths))
    return out


def touches(changed: str, referenced: str) -> bool:
    """True when the changed path IS the referenced file.

    Suffix matching runs one way only: a backlog entry may cite a path more
    loosely than git reports it, but a bare filename in the commit must not
    match a fully-qualified reference — that direction produces false hits on
    same-named files in different directories.
    """
    return changed == referenced or changed.endswith('/' + referenced)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    cmd = (payload.get('tool_input') or {}).get('command', '') or ''
    if not re.match(r'^\s*git\s+commit\b', cmd):
        return 0

    root = os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()
    try:
        changed = subprocess.run(
            ['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
            cwd=root, capture_output=True, text=True, timeout=10,
        ).stdout.split()
        md = open(os.path.join(root, BACKLOG), encoding='utf-8').read()
    except Exception:
        return 0
    if not changed:
        return 0

    hits = []
    for label, paths in parse_items(md):
        matched = sorted({c for c in changed for p in paths if touches(c, p)})
        if matched:
            hits.append((label, matched))
    if not hits:
        return 0

    lines = [
        'BACKLOG TOUCH CHECK — this commit changed files named by open backlog entries:',
        '',
    ]
    for label, matched in hits[:8]:
        shown = ', '.join(matched[:3]) + ('…' if len(matched) > 3 else '')
        lines.append(f'  • {label} — {shown}')
    if len(hits) > 8:
        lines.append(f'  … and {len(hits) - 8} more')
    lines += [
        '',
        'A touched file is NOT proof the item shipped — check each one against the code',
        'before acting. If an entry is now done, invoke /ship. If its claim is merely',
        'stale (as PUSH-UNITS-01 was), correct the entry in this commit.',
    ]

    json.dump({'hookSpecificOutput': {
        'hookEventName': 'PostToolUse',
        'additionalContext': '\n'.join(lines),
    }}, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
