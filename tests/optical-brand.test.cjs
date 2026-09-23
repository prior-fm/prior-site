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

// Butter reskin (founder decision 2026-09-23): Butter-first homepage,
// every old issue page kept and listed in the archive.
test('the homepage is Butter-first and archives every Prior issue', () => {
  assert.match(html, /<img class="logo" src="assets\/butter-logo\.png"/);
  assert.match(html, /AI engineering, explained smooth\. One concept per loop\./);
  assert.match(html, /https:\/\/julianlaycock\.github\.io\/butter-explains\/context\.html/);
  assert.match(html, /Archive: earlier issues \(Prior\)/);
  for (const id of ['latest', 'archive', 'subscribe', 'experiment', 'learn', 'about', 'journey'])
    assert.match(html, new RegExp(`id="${id}"`), `anchor #${id} still resolves`);
  for (const f of fs.readdirSync('.').filter(f => /^no-\d+\.html$/.test(f)))
    assert.ok(html.includes(`href="${f}"`), `archive lists ${f}`);
});

test('every page links the shared Butter stylesheet', () => {
  for (const f of fs.readdirSync('.').filter(f => f.endsWith('.html')))
    assert.ok(fs.readFileSync(f, 'utf8').includes('href="assets/butter.css"'), f);
});
