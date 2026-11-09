import test from 'node:test';
import assert from 'node:assert/strict';
import {PATTERNS,SPELL_PATTERN,resample,scoreStroke} from '../dist/js/gestures.js';

const draw=(id,{scale=280,x=60,y=40,wobble=0}={})=>resample(PATTERNS[id].pts,70).map(([px,py],i)=>[x+px*scale+Math.sin(i*.7)*wobble,y+py*scale+Math.cos(i*.5)*wobble]);

test('every wand pattern recognises itself and rejects the others',()=>{
  for(const id of Object.keys(PATTERNS)){
    assert.ok(scoreStroke(draw(id,{wobble:6}),id).score>0.85,`${id} should match itself`);
    for(const other of Object.keys(PATTERNS))if(other!==id)assert.ok(scoreStroke(draw(id,{wobble:6}),other).score<0.5,`${id} drawn should not pass as ${other}`);
  }
});
test('drawing size and position do not matter, direction does',()=>{
  assert.ok(scoreStroke(draw('slash',{scale:90,x:300,y:10}),'slash').score>0.9);
  const back=scoreStroke(draw('zigzag').reverse(),'zigzag');
  assert.equal(back.reversed,true);assert.ok(back.score<0.3);
});
test('a circle may start anywhere and go either way',()=>{
  const c=draw('circle');
  assert.ok(scoreStroke([...c.slice(25),...c.slice(1,26)],'circle').score>0.85);
  assert.ok(scoreStroke(c.slice().reverse(),'circle').score>0.85);
});
test('a tiny scribble never counts',()=>{
  const r=scoreStroke([[0,0],[12,9],[20,3]],'up');
  assert.equal(r.tooShort,true);assert.ok(r.score<=0.2);
});
test('every lesson spell has a pattern',()=>{
  for(const s of ['lumos','leviosa','protego','expelliarmus'])assert.ok(PATTERNS[SPELL_PATTERN[s]]);
});
