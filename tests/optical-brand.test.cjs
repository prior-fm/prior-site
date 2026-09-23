const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const brand = fs.readFileSync('assets/brand.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const material = ['assets/optical-hero.css', 'assets/optical-sections.css']
  .map(path => fs.readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');

// The archived Prior issue pages still load brand.css; its tokens stay intact
// (the Butter reskin remaps them from assets/butter.css instead of editing them).
test('the archived Prior brand tokens are unchanged', () => {
  for (const declaration of [
    '--font-body: Hanken, Arial, sans-serif;',
    '--font-brand: Printvetica, Archivo, Arial, sans-serif;',
    '--brand-tracking: 0.22em;', '--mark-stroke: 11;',
    '--paper: #f1ecdf;', '--ink: #0a0a0a;', '--blue: #b0cbd6;', '--clay: #da9062;',
  ]) assert.ok(brand.includes(declaration), declaration);
  assert.doesNotMatch(material, /(?:^|[;{\s])(?:font(?:-[\w-]+)?|letter-spacing|line-height)\s*:/);
  assert.doesNotMatch(material, /@font-face|--font-(?:body|brand)\s*:|--brand-tracking\s*:/);
});

// Butter B+ homepage (founder approval 2026-09-23): Butter-first, with every old
// Prior issue page kept and listed in the archive, and Ep.02 behind the release gate.
test('the homepage is Butter-first and archives every Prior issue', () => {
  assert.match(html, /<img src="assets\/logo-ink\.png" alt="Butter"/);
  assert.match(html, /AI engineering, explained smooth\./);
  assert.match(html, /href="cheatsheets\/context\.html"/);
  assert.match(html, /Archive: earlier issues \(Prior\)/);
  for (const id of ['latest', 'archive', 'subscribe', 'experiment', 'learn', 'about', 'journey', 'episodes'])
    assert.match(html, new RegExp(`id="${id}"`), `anchor #${id} still resolves`);
  for (const f of fs.readdirSync('.').filter(f => /^no-\d+\.html$/.test(f)))
    assert.ok(html.includes(`href="${f}"`), `archive lists ${f}`);
});

test('Ep.02 (prod) is only reachable through release-gated elements', () => {
  for (const page of ['index.html', 'cheatsheets/index.html', 'cheatsheets/context.html']) {
    const src = fs.readFileSync(page, 'utf8');
    assert.ok(src.includes('release.js'), `${page} loads the release gate`);
    // every element that links prod.html sits inside a data-release block
    const stripped = src.replace(/<(section|article|li|div)\b[^>]*data-release="[^"]+"[^>]*>[\s\S]*?<\/\1>/g, '');
    assert.doesNotMatch(stripped, /href="(?:cheatsheets\/)?prod\.html/, page);
  }
  assert.match(fs.readFileSync('style.css', 'utf8'), /\[data-release\]:not\(\.is-released\)\{display:none!important\}/);
});

test('every page links the shared Butter stylesheet', () => {
  // Old Prior pages use butter.css; the B+ pages (home, cheat sheets) use style.css;
  // context.html / prod.html at the root are redirect stubs.
  const bplus = new Set(['index.html', 'context.html', 'prod.html']);
  for (const f of fs.readdirSync('.').filter(f => f.endsWith('.html') && !bplus.has(f)))
    assert.ok(fs.readFileSync(f, 'utf8').includes('href="assets/butter.css"'), f);
});
