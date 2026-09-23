# PRIOR — site

Static site, GitHub Pages. Hand-written HTML/CSS, no framework, no build step.

Same design system as the videos: four full-bleed field modes (parchment, powder
blue, terracotta, black), overlapping slab geometry whose intersections show a
third tone, one typeface, hard edges, type cropped at the frame edge.

- `index.html` — hero, latest issue, how-it-works, subscribe, archive
- `no-0NN.html` — one page per issue
- `assets/site.css` — the whole design system
- `media/` — video and poster per issue

**Typeface note:** set in Printvetica (Javier Guaschetti / Pixel Surplus), free for
commercial use, subset here to only the glyphs this site renders. Archivo Black (OFL)
is the fallback.

Wordmark is tagged `data-wordmark` throughout, so renaming is a single change.

## Butter (B+) site — 2026-09-23

- `index.html` — Butter homepage (B+ design) + "Archive: earlier issues (Prior)".
- `cheatsheets/` — the cheat-sheet library, `context.html` (Ep.01), `prod.html` (Ep.02).
- `style.css`, `loops.js` — the B+ stylesheet and muted-loop player.
- `assets/butter.css` — restyles the old Prior pages (`no-0NN.html`, privacy, …) to match.
- `context.html`, `prod.html` at the root — redirect stubs for the old Butter-site URLs.

**Release gate (Ep.02).** Elements marked `data-release="2026-09-25"` are hidden by
`style.css` and removed by `release.js` before that date; elements marked
`data-until="2026-09-25"` (the Ep.01 hero) are removed on/after it. So Ep.02 appears on the
homepage, in the library and as the "Next" link on the Ep.01 sheet automatically on
2026-09-25. To release early or postpone, change that date everywhere it appears:
`grep -rn '2026-09-25' index.html cheatsheets/`. Preview the released state with
`?preview-release` on any page URL. `cheatsheets/prod.html` itself is always reachable
by direct URL (and via the `/prod.html` stub).
