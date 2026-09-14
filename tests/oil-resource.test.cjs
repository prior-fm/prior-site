const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('OIL page delivers a local map ZIP without publishing the held film',()=>{
 const html=fs.readFileSync('oil-map.html','utf8');
 assert.match(html,/packs\/prior-oil-editable-map\.zip/);
 assert.match(html,/schematic editorial reconstruction, not navigation data/);
 assert.doesNotMatch(html,/<video|\.mp4|0\.85|3\.2 million|least in 13/i);
 for(const rel of ['packs/prior-oil-editable-map.zip','assets/oil-resource/prior.png','assets/oil-resource/Newsreader-Regular.woff2','assets/oil-resource/IBMPlexMono-Regular.ttf'])assert.ok(fs.statSync(rel).size>0,rel);
 assert.equal(fs.readFileSync('packs/prior-oil-editable-map.zip').subarray(0,2).toString(),'PK');
 assert.ok(fs.existsSync('no-021.html')&&fs.existsSync('no-022.html'),'Preserve current issue pages');
});
