import {readdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const file of readdirSync('dist/js').filter(f=>f.endsWith('.js'))){const check=spawnSync(process.execPath,['--check','dist/js/'+file],{encoding:'utf8'});if(check.status){console.error(check.stderr);process.exit(1);}}
const html=readFileSync('dist/index.html','utf8'),game=readFileSync('dist/js/game.js','utf8');
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]));
if(ids.size!==[...html.matchAll(/id="([^"]+)"/g)].length)throw Error('Duplicate HTML ID');
for(const name of ['viewport','loading','hud','spellbar','panel','dialogue','quest-title','quest-objective','interact'])if(!ids.has(name))throw Error('Missing UI: '+name);
if(!game.includes('hogwarts-rpg')&&!readFileSync('dist/js/state.js','utf8').includes('hogwarts-rpg-v1'))throw Error('Independent save key missing');
console.log('Syntax and UI entry points verified.');
