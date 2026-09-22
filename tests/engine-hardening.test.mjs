import test from "node:test";
import assert from "node:assert/strict";
import {
 MathCore as Math, Generation as G, Streaming as S, Materials as M,
 Lighting as L, Weather as W, Water as O, Dynamics as D,
 Airframes as A, Infrastructure as I, Experience as E, Performance as P
} from "../src/engine/index.js";
const approx=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≉ ${b}`);
test("invalid grid shapes fail before allocating",()=>{
 assert.throws(()=>Math.grid(2.5,4,()=>1),RangeError);
 assert.throws(()=>Math.sampleGrid(new Float32Array(3),2,2,0,0),RangeError);
 assert.throws(()=>G.hydraulicErosion(new Float32Array(9),2.5,4),TypeError);
});
test("erosion preserves sediment and thermal mass",()=>{
 const heights=new Float32Array(64);
 heights[27]=100;
 const mass=heights.reduce((a,b)=>a+b,0);
 const thermal=G.thermalErosion(heights,8,8,{iterations:5});
 approx(thermal.reduce((a,b)=>a+b,0),mass,.0001);
 const dry=G.aeolianErosion(heights,8,8,{windX:0,windY:0});
 assert.deepEqual(dry,heights);
 const r=G.depositSediment(heights,new Float32Array(64).fill(2),8,8,2);
 approx(r.sediment[0],0);
 approx(r.height[0],2);
 const small=G.hydraulicErosion(new Float32Array(4),2,2);
 assert.equal(small.length,4);
});
test("hydraulic erosion is deterministic with a seed",()=>{
 const heights=new Float32Array(64);
 heights[27]=70;heights[36]=20;
 const one=G.hydraulicErosion(heights,8,8,{iterations:100,seed:50});
 const two=G.hydraulicErosion(heights,8,8,{iterations:100,seed:50});
 assert.deepEqual(one,two);
 assert.deepEqual(heights[27],70);
});
test("mesh extractor rejects excessive cells",()=>{
 assert.throws(()=>G.marchingCubesTetrahedra(()=>0,1000,1000,1000),RangeError);
});
test("octree and quadtree cap includes all descendants",()=>{
 const count=n=>n?1+(n.children||[]).reduce((s,c)=>s+count(c),0):0;
 assert.ok(count(S.quadtree({x:0,y:0,size:300},20,()=>2,1,32))<=32);
 assert.ok(count(S.octree({x:0,y:0,z:0,size:300},20,()=>1,32))<=32);
});
test("invalid visibility buffers and transform matrices are rejected",()=>{
 assert.throws(()=>S.hierarchicalZBuffer([0,1],2,2),RangeError);
 assert.throws(()=>S.packInstances([[1,2,3]]),RangeError);
 assert.throws(()=>S.geomorph([1,2],[1],.5),RangeError);
});
test("game asset residency and foliage sampling remain budgeted",()=>{
 assert.ok(M.virtualTexturePages({
 left:-100000,top:-100000,right:100000,bottom:100000
 },10,64,25).length<=25);
 assert.equal(I.vegetationDistribution({
 x:0,z:0,width:1e6,height:1e6},.5,()=>true,1,17).length,17);
});
test("material weights do not become NaN for degenerate vectors",()=>{
 assert.deepEqual(M.triplanarWeights({x:0,y:0,z:0}),[0,1,0]);
 assert.deepEqual(M.textureSplat([[1,0,0]],[0]),[0,0,0,0]);
 const n=M.normalMapFromHeight(()=>1,0,0,0);
 assert.ok(n.every(Number.isFinite));
});
test("physical light kernels remain finite at extreme values",()=>{
 approx(L.rayleighScattering(0),1,1);
 assert.ok(Number.isFinite(L.mieScattering(1,.99999999)));
 assert.throws(()=>L.cascadedShadowSplits(0,1000),RangeError);
 const moon=L.lunarEphemeris(new Date("2026-09-22T15:00:00Z"),0,0);
 assert.ok(Number.isFinite(moon.phase));
});
test("weather integration bounds prevent extreme work",()=>{
 const fog=W.cloudRaymarch({origin:{x:0,y:0,z:0},
 direction:{x:0,y:0,z:1}},100000,()=>.4,{distance:200});
 assert.ok(fog.transmittance>=0&&fog.transmittance<=1);
 const cloud=W.cumulonimbusProfile(3000,{base:1000,top:1000});
 assert.ok(Number.isFinite(cloud.radius));
});
test("water numerical limits and zero-speed behavior",()=>{
 assert.throws(()=>O.fftOceanSurface([],[],4096),RangeError);
 assert.throws(()=>O.fresnelReflection(.5,-1,1.3),RangeError);
 assert.ok(Number.isFinite(O.shoalingWaves(1,0,0).amplitude));
 assert.ok(Number.isFinite(O.wakeField(1,1,1,{width:0})));
});
test("aero tables reject duplicates and unsorted rows",()=>{
 assert.throws(()=>D.lookupAeroTable([{x:1,value:0},{x:1,value:1}],.5),RangeError);
 assert.throws(()=>D.lookupAeroTable([{x:2,value:0},{x:1,value:1}],.5),RangeError);
});
test("engine zero RPM produces zero thrust",()=>{
 assert.equal(D.propellerPerformance(0,0).thrust,0);
 assert.throws(()=>D.propellerPerformance(1500,50,{diameter:0}),RangeError);
});
test("fuel transfer cannot transfer to itself or overflow",()=>{
 const tanks=[{fuel:20,capacity:40,arm:-1},
 {fuel:30,capacity:40,arm:1}];
 const self=D.fuelTransfer(tanks,10,0,0);
 assert.equal(self.transferred,0);
 assert.deepEqual(self.tanks,tanks);
 const moved=D.fuelTransfer(tanks,1000,0,1);
 assert.equal(moved.transferred,10);
 approx(moved.tanks[0].fuel+moved.tanks[1].fuel,50);
 assert.deepEqual(tanks[0].fuel,20);
});
test("no spring force without contact and no lift integration with invalid inertia",()=>{
 assert.equal(D.landingGearSpring(-.1,100),0);
 assert.throws(()=>D.rigidBody6DOF({
 q:{w:1,x:0,y:0,z:0},omega:{x:0,y:0,z:0},
 velocity:{x:0,y:0,z:0},position:{x:0,y:0,z:0}
 },{x:0,y:0,z:0},{x:0,y:0,z:0},1000,{x:0,y:10,z:10},.1),RangeError);
});
test("visual airframe generation and replay enforce budgets",()=>{
 assert.throws(()=>A.parametricFuselage([{z:0,rx:1,ry:1}],16),RangeError);
 assert.throws(()=>A.airfoilWingMesh({span:-10}),RangeError);
 assert.deepEqual(E.combinatorialMissions([],[],["cargo"]),[]);
 assert.deepEqual(E.combinatorialMissions([{id:"A",x:0,z:0}],[],["cargo"]),[]);
});
test("frame-time metrics exclude invalid samples",()=>{
 const profile=P.gpuTimeProfiling([1,2,NaN,4]);
 approx(profile.mean,7/3);
 assert.equal(P.memoryLeakWatch([10,11,12],{window:0}).growthMB,2);
 assert.ok(P.adaptiveResolution(1,30)<1);
});
test("queueing and recovery remain stable with duplicate inputs",async()=>{
 assert.deepEqual(await S.boundedWorkerPool([5,5,5],2,
 async(_,index)=>index+1),[1,2,3]);
 const out=await P.errorRecovery(async()=>{throw Error("bad")},
 ()=>7,{attempts:1000})();
 assert.equal(out,7);
});
