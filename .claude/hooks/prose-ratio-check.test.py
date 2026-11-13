"""PROSE-RATIO-01 — 14 cases, both directions.

Tests `verdict` directly: the measurement is `git diff`, which the cases below do not
need, and the thing worth holding is WHEN it speaks and when it stays silent.
"""
import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('prc', Path(__file__).parent / 'prose-ratio-check.py')
prc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prc)

CASES = [
    # (comments, total, should_speak, why)   limit 0.55, floor 25 comment lines
    (0, 0, False, 'an empty diff says nothing'),
    (0, 100, False, 'no comments at all'),
    (24, 30, False, 'under the 25-line floor — 24 commented lines is not a habit'),
    (60, 100, True, '60% is over the 55% limit'),
    (50, 100, False, '50% is under the 55% limit'),
    (55, 100, False, 'exactly at the limit is NOT over it'),
    (56, 100, True, 'one line over the limit speaks'),
    (48, 100, False, 'exactly house practice stays silent'),
    (421, 683, True, 'the measured wave-1-3 ratio, 62% — the case this exists for'),
    (951, 1977, False, 'the prior-50 ratio, 48% — the practice it must NOT fire on'),
    (26, 26, True, 'a diff that is ALL comment'),
    (100, 0, False, 'total 0 cannot divide — must not throw'),
    (24, 24, False, 'all comment but under the count floor'),
    (1000, 10000, False, '10% over a huge diff'),
]

passed = failed = 0
for comments, total, should, why in CASES:
    try:
        got = prc.verdict(comments, total) is not None
    except Exception as e:                                    # noqa: BLE001
        print(f'  x THREW on ({comments},{total}): {e}'); failed += 1; continue
    if got == should:
        print(f'  v {why}'); passed += 1
    else:
        print(f'  x {why} — expected speak={should}, got {got}'); failed += 1

# The message must carry the measurement, or it is a nag rather than a finding.
msg = prc.verdict(421, 683) or ''
for needle, why in [('62%', 'states the measured ratio'),
                    ('48%', 'states the house practice it is derived from'),
                    ('RAN', 'asks the verify-before-claim question')]:
    if needle in msg:
        print(f'  v {why}'); passed += 1
    else:
        print(f'  x message does not {why}'); failed += 1

print(f'\n  {passed} passed, {failed} failed  ({len(CASES) + 3} cases)')
sys.exit(1 if failed else 0)
