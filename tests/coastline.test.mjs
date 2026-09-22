import test from "node:test";
import assert from "node:assert/strict";
import {novaIrisCoastHeight} from "../src/coastline.js";
import {sampleAetheriaHeight} from "../src/aetheria.js";
import {AETHERIA_AIRPORTS} from "../src/aetheria-data.js";

test("Nova Iris opens onto an ocean with a gradual shoreline",()=>{
 const x=-16000;
 const inland=novaIrisCoastHeight(x,-8500,40);
 const water=novaIrisCoastHeight(x,-2700,40);
 assert.equal(inland,40);
 assert.ok(water<0,water+" must be under sea level");
 let previous=inland;
 for(let z=-8500;z<=-2700;z+=25){
  const next=novaIrisCoastHeight(x,z,40);
  assert.ok(Number.isFinite(next));
  assert.ok(Math.abs(next-previous)<6,"No vertical coastal cliff");
  previous=next;
 }
 assert.ok(sampleAetheriaHeight(-16000,-2700)<0,
  "The integrated world must render open water, not just a helper");
});

test("shore remains outside all four operational runways",()=>{
 for(const airport of AETHERIA_AIRPORTS){
  const half=airport.runways[0].length/2;
  const angle=airport.heading*Math.PI/180;
  for(const d of [-half,0,half]){
   const x=airport.x+Math.sin(angle)*d;
   const z=airport.z-Math.cos(angle)*d;
   assert.ok(Math.abs(sampleAetheriaHeight(x,z)-
    (airport.elevation-1))<1e-6,airport.id);
  }
 }
});

test("coastal domain is finite and unchanged outside authored peninsula",()=>{
 assert.equal(novaIrisCoastHeight(-24000,-3000,40),40);
 assert.equal(novaIrisCoastHeight(-4500,-3000,40),40);
 for(let x=-24000;x<=-4000;x+=250)
  for(let z=-9000;z<=-1500;z+=250)
   assert.ok(Number.isFinite(novaIrisCoastHeight(x,z,40)));
 assert.throws(()=>novaIrisCoastHeight(NaN,0,40),RangeError);
});
