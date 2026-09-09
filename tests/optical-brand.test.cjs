const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const brand = fs.readFileSync('assets/brand.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const material = ['assets/optical-hero.css', 'assets/optical-sections.css']
  .map(path => fs.readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');

test('the optical direction retains the approved web identity and official bracket', () => {
  for (const declaration of [
    '--font-body: Hanken, Arial, sans-serif;',
    '--font-brand: Printvetica, Archivo, Arial, sans-serif;',
    '--brand-tracking: 0.22em;', '--mark-stroke: 11;',
    '--paper: #f1ecdf;', '--ink: #0a0a0a;', '--blue: #b0cbd6;', '--clay: #da9062;',
  ]) assert.ok(brand.includes(declaration), declaration);
  const marks = [...html.matchAll(/<svg class="mark"[^>]*>([\s\S]*?)<\/svg/g)];
  assert.ok(marks.length > 0);
  for (const [, mark] of marks) assert.match(mark, /d="M34 6H6V94H34M66 6H94V94H66"/);
  assert.match(html, /<span data-wordmark>Prior<\/span>/);
});

test('material styles cannot substitute typefaces or turn the concept mockup into page content', () => {
  assert.doesNotMatch(material, /(?:^|[;{\s])(?:font(?:-[\w-]+)?|letter-spacing|line-height)\s*:/);
  assert.doesNotMatch(material, /@font-face|--font-(?:body|brand)\s*:|--brand-tracking\s*:/);
  assert.doesNotMatch(html, /<img[^>]+(?:glass-concepts|warm-optical-studio|crystal-gallery)/);
  assert.match(html, /<img class="optical-lens"[^>]+alt=""/);
});
