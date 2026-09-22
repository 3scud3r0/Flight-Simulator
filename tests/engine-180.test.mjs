import test from "node:test";
import assert from "node:assert/strict";
import {
 catalog,getAlgorithm,runAlgorithm,algorithmGroups,
 Generation,Streaming,Materials,Lighting,Weather,Water,Dynamics,
 Airframes,Infrastructure,Experience,Performance
} from "../src/engine/index.js";

test("all 180 numbered algorithm cores exist exactly once",()=>{
 assert.equal(catalog.length,180);
 assert.deepEqual(catalog.map(x=>x.id),Array.from({length:180},(_,i)=>i+1));
 assert.equal(new Set(catalog.map(x=>x.name)).size,180);
 assert.equal(algorithmGroups.reduce((n,g)=>n+g.algorithms.length,0),180);
 for(const entry of catalog){
  assert.equal(typeof entry.run,"function");
  assert.match(entry.code,/^A\d{3}$/);
  assert.equal(getAlgorithm(entry.code),entry);
  assert.equal(getAlgorithm(entry.id),entry);
 }
 assert.equal(getAlgorithm("A181"),null);
 assert.throws(()=>runAlgorithm(181),RangeError);
});
test("geology is seeded and stable",()=>{
 const f=Generation.fractalBrownianMotion;
 assert.equal(f(2.25,4.75,{seed:55}),f(2.25,4.75,{seed:55}));
 assert.ok(Number.isFinite(Generation.domainWarp(3,7,99).value));
 assert.ok(Number.isFinite(Generation.volcanicCaldera(3,2)));
 assert.ok(Number.isFinite(Generation.simplex2(3,2)));
 assert.equal(runAlgorithm("A001",2,3,4),Generation.perlin2(2,3,4));
});
test("hydraulic and thermal erosion conserve array shape and input",()=>{
 const grid=new Float32Array(64).map((_,i)=>i===27?100:0);
 const old=Float32Array.from(grid);
 const hydraulic=Generation.hydraulicErosion(grid,8,8,{iterations:15});
 const thermal=Generation.thermalErosion(grid,8,8,{iterations:3});
 assert.equal(hydraulic.length,64);assert.equal(thermal.length,64);
 assert.deepEqual(grid,old);
 assert.ok(thermal[27]<100);
});
test("rivers, basin tracing and caves return finite values",()=>{
 const heights=new Float32Array([9,8,7,6,5,4,3,2,1]);
 const flow=Generation.riverFlowDirection(heights,3,3);
 assert.equal(flow.length,9);
 assert.equal(Generation.watershedBasins(flow,3,3).length,9);
 assert.ok(Number.isFinite(Generation.caveDensity(10,20,30)));
});
test("mesh extraction emits actual vertices and valid indices",()=>{
 const m=Generation.marchingCubesTetrahedra(
 (x,y,z)=>x+y+z-1.8,3,3,3);
 assert.ok(m.vertices.length>0);
 assert.ok(m.triangles.length>0);
 for(const t of m.triangles)for(const i of t)
 assert.ok(i>=0&&i<m.vertices.length);
 assert.ok(Generation.dualContourCell((x,y,z)=>x-.5,0,0,0));
});
test("LOD and clipping produce finite bounded decisions",()=>{
 const tree=Streaming.quadtree({x:0,y:0,size:256},3,b=>b.size);
 assert.equal(tree.children.length,4);
 assert.ok(Streaming.screenSpaceError(4,100,Math.PI/3,900)>0);
 assert.equal(Streaming.frustumCullSphere(
 [{n:{x:0,y:1,z:0},d:2}],{x:0,y:0,z:0},1),true);
 assert.equal(Streaming.memoryBudget(
 [{id:"a",bytes:90,priority:0},{id:"b",bytes:15,priority:2}],
 30).kept.has("a"),false);
});
test("worker queue respects original result order",async()=>{
 assert.deepEqual(await Streaming.boundedWorkerPool(
 [4,2,3],2,async n=>n*3),[12,6,9]);
});
test("materials blend and generated normals are normalized",()=>{
 const material=Materials.pbrMaterial({roughness:2,metallic:-2});
 assert.equal(material.roughness,1);assert.equal(material.metallic,0);
 const n=Materials.normalMapFromHeight((x,y)=>x+y,0,0);
 assert.ok(Math.abs(Math.hypot(...n)-1)<1e-9);
 const color=Materials.textureSplat([[1,0,0],[0,0,1]],[1,1]);
 assert.equal(color[0],.5);assert.equal(color[2],.5);
});
test("solar ephemeris changes from local noon to midnight",()=>{
 const noon=Lighting.solarEphemeris(
 new Date("2026-09-22T15:00:00Z"),-22.93,-43.21);
 const night=Lighting.solarEphemeris(
 new Date("2026-09-22T03:00:00Z"),-22.93,-43.21);
 assert.ok(noon.elevationDeg>20);
 assert.ok(night.elevationDeg<0);
 assert.ok(Lighting.rayleighScattering(450)>Lighting.rayleighScattering(650));
});
test("GPU-style lighting kernels produce bounded values",()=>{
 assert.equal(Lighting.acesTonemap([0,1,40]).length,3);
 assert.equal(Lighting.cascadedShadowSplits(.1,1000,4).length,4);
 assert.ok(Lighting.volumetricFogRay({
 origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1}
 },12,()=>({density:.002,light:[1,1,1]})).transmittance<1);
});
test("weather evolves continuously and is deterministic",()=>{
 const a=Weather.cloudWeatherMap(80,60,3,{seed:55});
 assert.deepEqual(a,Weather.cloudWeatherMap(80,60,3,{seed:55}));
 assert.ok(Weather.meteorologicalVisibility(.95,.8,.7,0)<10000);
 assert.ok(Weather.thermalUpdraft(0,1000)>0);
 assert.ok(Weather.airframeIcing(-5,.8,45,2)>0);
});
test("2D inverse FFT transforms DC into constant surface",()=>{
 const values=Water.fftOceanSurface([4,0,0,0],[0,0,0,0],2);
 assert.equal(values.length,4);
 for(const v of values)assert.ok(Math.abs(v-1)<1e-9);
 assert.ok(Water.fresnelReflection(.1)>Water.fresnelReflection(1));
});
test("quaternion and fourth-order integration are stable",()=>{
 const q=Dynamics.quaternionIntegrate(
 {w:1,x:0,y:0,z:0},{x:0,y:1,z:0},.2);
 assert.ok(Math.abs(Math.hypot(q.w,q.x,q.y,q.z)-1)<1e-9);
 const [x]=Dynamics.rungeKutta4([1],.1,([v])=>[v]);
 assert.ok(Math.abs(x-Math.exp(.1))<1e-5);
});
test("stall, induced drag and ground effect have plausible responses",()=>{
 assert.equal(Dynamics.stallHysteresis(false,.3),true);
 assert.equal(Dynamics.stallHysteresis(true,.23),true);
 assert.ok(Dynamics.inducedDrag(2)>Dynamics.inducedDrag(1));
 assert.ok(Dynamics.groundEffect(.1,12,1).lift>1);
});
test("continuous collision detects crossing through terrain",()=>{
 const hit=Dynamics.continuousCollision({x:0,y:100,z:0},
 {x:0,y:-200,z:0},1,()=>0);
 assert.equal(hit.hit,true);
 assert.ok(Math.abs(hit.position.y)<1e-4);
});
test("LQR returns bounded and finite control",()=>{
 const ctrl=Dynamics.lqrController(
 [[1,1],[0,1]],[[0],[1]],[[1,0],[0,1]],1);
 const control=ctrl.control([2,.5]);
 assert.ok(Number.isFinite(control));
 assert.ok(control>=-1&&control<=1);
});
test("airframe mesh generation and flight instruments",()=>{
 const fuselage=Airframes.parametricFuselage([
 {z:-2,cx:0,cy:0,rx:.2,ry:.2},
 {z:2,cx:0,cy:0,rx:.6,ry:.5}]);
 assert.ok(fuselage.vertices.length>30);
 const wing=Airframes.airfoilWingMesh();
 assert.ok(wing.vertices.length>100);
 assert.equal(Airframes.flightInstruments({
 speed:50,y:100,verticalSpeed:1}).iasKnots,50*1.943844);
});
test("infrastructure routing finds shortest route",()=>{
 const edges=new Map([[0,[{node:1,cost:1},{node:2,cost:5}]],
 [1,[{node:2,cost:2}]],[2,[]]]);
 const route=Infrastructure.obstacleAvoidingPath([0,1,2],0,2,
 node=>edges.get(node),()=>0);
 assert.deepEqual(route.path,[0,1,2]);
 assert.equal(route.cost,3);
});
test("gameplay replay and mission functions are deterministic",()=>{
 const replay=Experience.deterministicReplay({x:0},[1,2,3],
 (state,n)=>({x:state.x+n}));
 assert.deepEqual(replay.map(s=>s.x),[0,1,3,6]);
 assert.ok(Number.isFinite(Experience.trajectoryScore([
 {hit:true,precision:.8,speed:60}])));
});
test("adaptive quality reduces expensive work on slow frames",()=>{
 assert.ok(Performance.adaptiveResolution(1,40)<1);
 assert.ok(Performance.dynamicQualityBudget({frameMs:42},{
 cloudSteps:32,shadowDistance:4000,vegetationDistance:1000
 }).cloudSteps<32);
 assert.equal(Performance.physicsInvariantTests({
 x:0,y:0,z:0,vx:0,vy:0,vz:0,speed:0,
 q:{w:1,x:0,y:0,z:0}}).ok,true);
});
test("resource pool and error fallback remain bounded",async()=>{
 const pool=Performance.objectPool(()=>({value:1}),x=>{x.value=0},2);
 const item=pool.acquire();assert.equal(pool.release(item),true);
 assert.equal(pool.acquire().value,0);
 const outcome=await Performance.errorRecovery(
 async()=>{throw Error("offline")},()=>42,{attempts:2})();
 assert.equal(outcome,42);
});

test("bounded spatial trees terminate under worst-case uniform occupancy",()=>{
 const q=Streaming.quadtree({x:0,y:0,size:1000},20,()=>100,1,30);
 const o=Streaming.octree({x:0,y:0,z:0,size:1000},20,()=>1,30);
 const count=n=>1+(n.children||[]).reduce((s,c)=>s+count(c),0);
 assert.ok(count(q)<=30);
 assert.ok(count(o)<=30);
});
test("duplicate worker jobs retain distinct output positions",async()=>{
 const result=await Streaming.boundedWorkerPool([2,2,2],2,
 async (_value,index)=>index*10);
 assert.deepEqual(result,[0,10,20]);
});
test("virtual texture and vegetation algorithms enforce hard budgets",()=>{
 const pages=Materials.virtualTexturePages({
 left:-10000,top:-10000,right:10000,bottom:10000
 },10,64,50);
 assert.ok(pages.length<=50);
 const plants=Infrastructure.vegetationDistribution({
 x:0,z:0,width:100000,height:100000
 },.5,()=>true,1,25);
 assert.equal(plants.length,25);
 assert.throws(()=>Water.fftOceanSurface([],[],4096),RangeError);
});
