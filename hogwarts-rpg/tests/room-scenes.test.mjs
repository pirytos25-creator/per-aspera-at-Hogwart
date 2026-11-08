import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/assets/three.module.js';
import {ROOMS} from '../dist/js/data.js';
import {createRoomIdentity} from '../dist/js/room-identity.js';
import {createRoomActivityProps} from '../dist/js/room-activities.js';

test('all room additions produce finite geometry and dispose their resources once',()=>{
 for(const room of ROOMS){
  const identity=createRoomIdentity(room),station=createRoomActivityProps(room.id,THREE);
  assert.ok(identity.group.userData.drawCalls>0&&identity.group.userData.drawCalls<20,room.id);
  const resources=new Set();
  for(const asset of [identity,station]){asset.update(123);asset.group.updateMatrixWorld(true);asset.group.traverse(o=>{if(!o.isMesh)return;assert.ok(o.matrixWorld.elements.every(Number.isFinite),room.id);for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v),room.id);resources.add(o.geometry);resources.add(o.material);});}
  let disposals=0;for(const r of resources)r.addEventListener('dispose',()=>disposals++);
  identity.dispose();station.dispose();identity.dispose();station.dispose();
  assert.equal(disposals,resources.size,room.id);assert.equal(identity.group.children.length,0);assert.equal(station.group.children.length,0);
 }
});
