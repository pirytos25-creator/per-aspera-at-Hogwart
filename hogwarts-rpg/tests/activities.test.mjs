import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS} from '../dist/js/data.js';
import {ACTIVITIES,createActivitySession} from '../dist/js/room-activities.js';
import {newState,hydrate,finishRoom,ROOM_REWARD} from '../dist/js/state.js';

function solve(id,session){
 const a=ACTIVITIES[id],send=action=>{const s=session.dispatch(action);assert.equal(s.failed,false,`${id}: ${s.message}`);};
 switch(a.kind){
  case 'dials': for(let i=0;i<a.target.length;i++)while(session.getState().values[i]!==a.target[i])send({index:i,delta:Math.sign(a.target[i]-session.getState().values[i])});send({type:'check'});break;
  case 'memorySequence':send({type:'reveal'});
  case 'sequence':case 'connect':case 'defence':for(const index of a.answer)send({index});break;
  case 'vector':case 'lights':for(const index of a.solution)send({index});break;
  case 'grid':for(const step of a.solution)send(a.knight?{index:step}:{direction:step});break;
  case 'order':for(let i=0;i<a.items.length;i++){let index=session.getState().values.indexOf(i);while(index>i)send({index:index--,delta:-1});}send({type:'check'});break;
  case 'numbergrid':for(const [index,value]of a.target.entries())if(!a.initial[index])send({index,value});send({type:'check'});break;
  case 'match':for(let index=0;index<a.left.length;index++){send({side:'left',index});send({side:'right',index});}break;
  case 'assign':for(const [index,bin]of (a.solution||a.target).entries()){send({type:'item',index});send({type:'bin',index:bin});}send({type:'check'});break;
  case 'duel':for(let i=0;i<3;i++){send({type:'guard'});send({type:'focus'});send({type:'attack'});}break;
  case 'sliding':for(const index of [8,...a.scramble.slice(0,-1)].reverse())send({index});break;
  case 'memory':for(const value of new Set(a.cards))for(const [index,card]of a.cards.entries())if(card===value)send({index});break;
  case 'jugs':for(const type of a.solution)send({type});break;
  case 'subset':for(const index of a.solution)send({index});send({type:'check'});break;
  default:assert.fail('Missing solver for '+id);
 }
 assert.equal(session.getState().done,true,`${id} must be completable`);
}

test('all 40 visitable rooms have a working challenge and no extra phantom rooms',()=>{
 assert.equal(ROOMS.length,40);
 assert.deepEqual(Object.keys(ACTIVITIES).sort(),ROOMS.map(r=>r.id).sort());
 for(const id of Object.keys(ACTIVITIES))solve(id,createActivitySession(id));
});

test('room rewards survive reload and cannot be farmed through reset or reopening',()=>{
 let state=newState(),calls=0;
 const complete=id=>{calls++;finishRoom(state,id);};
 const session=createActivitySession('potions',{complete});solve('potions',session);
 session.reset();solve('potions',session);assert.equal(calls,1);
 state=hydrate(JSON.parse(JSON.stringify(state)));
 solve('potions',createActivitySession('potions',{complete}));
 assert.equal(state.xp,ROOM_REWARD.xp);assert.equal(state.coins,ROOM_REWARD.coins);assert.deepEqual(state.roomsCompleted,['potions']);assert.equal(state.stage,0);
});

test('disposed sessions ignore pending input, including a winning move',()=>{
 let awarded=0;const s=createActivitySession('runes',{complete:()=>awarded++});s.dispatch({index:0});s.dispose();const before=JSON.stringify(s.getState());s.dispatch({index:8});s.reset();assert.equal(JSON.stringify(s.getState()),before);assert.equal(awarded,0);
});

test('wrong actions do not bypass instructions or required checkpoints',()=>{
 const recipe=createActivitySession('potions');recipe.dispatch({index:4});assert.equal(recipe.getState().step,0);assert.equal(recipe.getState().failed,true);
 const memory=createActivitySession('music');memory.dispatch({index:0});assert.equal(memory.getState().step,0);assert.equal(memory.getState().failed,true);
 const stairs=createActivitySession('stairs');stairs.dispatch({direction:'up'});stairs.dispatch({direction:'right'});stairs.dispatch({direction:'right'});stairs.dispatch({direction:'up'});assert.equal(stairs.getState().pos,17);assert.equal(stairs.getState().failed,true);
 const dials=createActivitySession('great-hall');dials.dispatch({type:'check'});assert.equal(dials.getState().done,undefined);assert.equal(dials.getState().failed,true);
});
