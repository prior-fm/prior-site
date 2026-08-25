"""Wire GoatCounter into every page of the site, in one pass.

    python add-analytics.py <site-code>        # e.g. priorfm
    python add-analytics.py --check            # report which pages carry it

WHY THIS EXISTS. The funnel's own `/report` has printed "opened page 0
(0% of commenters)" for every issue since No. 001, and it always would have:
it asks GoatCounter for views of `/no-00N.html`, but **no issue page has ever
carried a counter**. The only tag in the repo was commented out on index.html,
and the handle it names does not exist. So the middle step of the whole funnel —
DM sent, page opened, pack downloaded — has never been measured across ten
commenters and five delivered packs.

Found 2026-08-25 during the No. 007 launch.

The tag is added immediately before `</head>` on every .html file that has one.
Running it twice is safe; a page that already carries the tag is left alone.

Stdlib only.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
MARK = "data-goatcounter"

# The commented-out block on index.html, which this replaces wherever it appears.
DEAD = re.compile(
    r"[ \t]*<!--\s*analytics: re-enable once the goatcounter handle exists.*?-->\n",
    re.S)


def tag(code: str) -> str:
    return (
        '    <!-- analytics: GoatCounter. No cookies, no cross-site tracking, no\n'
        '         personal data. Declared in privacy.html. -->\n'
        f'    <script data-goatcounter="https://{code}.goatcounter.com/count"\n'
        '            async src="//gc.zgo.at/count.js"></script>\n')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("code", nargs="?", help="the GoatCounter site code, e.g. priorfm")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    pages = sorted(p for p in HERE.glob("*.html"))
    if args.check:
        # Strip comments BEFORE looking. index.html carries the tag inside a
        # <!-- --> block, and a naive substring search reports that page as
        # counted — which is the exact false reassurance that let this go
        # unnoticed for six issues.
        strip = re.compile(r"<!--.*?-->", re.S)
        for p in pages:
            live = MARK in strip.sub("", p.read_text(encoding="utf-8"))
            print(f"  {p.name:16s} {'counted' if live else 'NOT counted'}")
        return 0

    if not args.code:
        ap.error("give the GoatCounter site code, or --check")
    if not re.fullmatch(r"[a-z0-9-]{2,40}", args.code):
        ap.error("site code should be lowercase letters, digits and hyphens")

    changed = 0
    for p in pages:
        t = p.read_text(encoding="utf-8")
        t = DEAD.sub("", t)
        if MARK in t:
            print(f"  {p.name:16s} already carries a counter — left alone")
            continue
        if "</head>" not in t:
            print(f"  {p.name:16s} no <head> — skipped")
            continue
        # the closing tag keeps its own two-space indent; the block above it
        # is emitted at four, which is where every other <head> child sits
        t = t.replace("  </head>", tag(args.code) + "  </head>", 1)
        p.write_text(t, encoding="utf-8")
        changed += 1
        print(f"  {p.name:16s} counter added")

    print(f"\n  {changed} page(s) changed.")
    print("  Commit and push, then check a live page's network tab for gc.zgo.at,")
    print("  and confirm the funnel's /report stops saying 'opened page 0'.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
