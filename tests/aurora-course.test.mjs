import test from "node:test";
import assert from "node:assert/strict";
import {createAuroraCourse} from "../src/aurora-course.js";
import {sampleAuroraHeight} from "../src/aurora-data.js";
import {RING_COUNT} from "../src/challenge.js";

test("Aurora course visits lighthouse, bridge and village with clear gates",()=>{
 const gates=createAuroraCourse({x:4000,z:1650,y:285},sampleAuroraHeight);
 assert.equal(gates.length,RING_COUNT);
 for(const gate of gates){
  assert.ok(gate.y>=sampleAuroraHeight(gate.x,gate.z)+145);
  assert.ok(Math.abs(Math.hypot(gate.normal.x,gate.normal.z)-1)<1e-12);
 }
 const distance=(gate,x,z)=>Math.hypot(gate.x-x,gate.z-z);
 for(const [x,z] of [[4280,-650],[2460,-650],[-950,880]])
  assert.ok(Math.min(...gates.map(gate=>distance(gate,x,z)))<650);
});
