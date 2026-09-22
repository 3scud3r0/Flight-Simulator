import test from 'node:test';
import assert from 'node:assert/strict';
import {AURORA_AIRPORTS,AURORA_LANDMARKS,sampleAuroraHeight} from '../src/aurora-data.js';
import {createAuroraWorld} from '../src/aurora.js';
class V3 {constructor(x=0,y=0,z=0){this.set(x,y,z)}set(x,y,z){Object.assign(this,{x,y,z});return this}}
class Node {constructor(){this.children=[];this.position=new V3();this.rotation=new V3();this.scale=new V3(1,1,1);this.matrix={}}
 add(...items){for(const item of items){item.removeFromParent?.();item.parent=this;this.children.push(item)}}
 remove(...items){for(const item of items){const i=this.children.indexOf(item);if(i>=0)this.children.splice(i,1);item.parent=null}}
 removeFromParent(){this.parent?.remove(this)}updateMatrix(){this.matrix={}}}
class Geometry {setAttribute(){return this}setIndex(){return this}computeVertexNormals(){}dispose(){this.disposed=true}}
class Color {constructor(hex){this.set(hex)}set(hex){this.r=(hex>>16&255)/255;this.g=(hex>>8&255)/255;this.b=(hex&255)/255;return this}
 copy(o){Object.assign(this,{r:o.r,g:o.g,b:o.b});return this}lerp(o,t){this.r+=(o.r-this.r)*t;this.g+=(o.g-this.g)*t;this.b+=(o.b-this.b)*t;return this}
 multiplyScalar(s){this.r*=s;this.g*=s;this.b*=s;return this}setHex(v){return this.set(v)}}
class Material {constructor(opts={}){Object.assign(this,opts);this.color=new Color(opts.color??0xffffff)}dispose(){this.disposed=true}}
class Mesh extends Node {constructor(g,m){super();this.geometry=g;this.material=m}}
class Instances extends Mesh {constructor(g,m,count){super(g,m);this.count=count;this.instanceMatrix={}}setMatrixAt(){}}
class Light extends Node {constructor(){super();this.target=new Node()}}
const THREE={Group:Node,Object3D:Node,Mesh,InstancedMesh:Instances,
 PlaneGeometry:Geometry,BoxGeometry:Geometry,CylinderGeometry:Geometry,ConeGeometry:Geometry,
 SphereGeometry:Geometry,IcosahedronGeometry:Geometry,TorusGeometry:Geometry,BufferGeometry:Geometry,
 Float32BufferAttribute:class {constructor(data,size){this.data=data;this.size=size}},
 MeshStandardMaterial:Material,MeshBasicMaterial:Material,DirectionalLight:Light,
 HemisphereLight:Light,PointLight:Light,Color,DoubleSide:2};
test('Aurora DEM is deterministic, finite and level across the runway',()=>{
 const a=AURORA_AIRPORTS[0],r=a.heading*Math.PI/180;
 for(let offset=-550;offset<=550;offset+=110){
  const h=sampleAuroraHeight(a.x+Math.sin(r)*offset,a.z-Math.cos(r)*offset);
  assert.ok(Math.abs(h-14.95)<.01,`runway height at ${offset}: ${h}`);
 }
 for(let x=-6000;x<=6000;x+=500)for(let z=-5000;z<=5000;z+=500){
  const h=sampleAuroraHeight(x,z);assert.ok(Number.isFinite(h));
  assert.equal(h,sampleAuroraHeight(x,z));
 }
 assert.equal(AURORA_LANDMARKS.length,5);
});
test('Aurora renders, updates and releases its scene with basic Three contract',()=>{
 const scene=new Node(),renderer={toneMappingExposure:1};
 const world=createAuroraWorld(THREE,scene,renderer,{mobile:true});
 assert.equal(world.airports.length,1);assert.equal(world.tileCount,1);
 assert.ok(world.root.children.some(n=>n.name==='Aurora_Terrain'));
 world.update(2450,-650,1/60);world.updateEnvironment(22,'nublado',1/60);
 assert.ok(world.status.includes('Ponte dos Arcos'));
 assert.ok(Number.isFinite(world.sun.intensity));
 world.dispose();assert.equal(world.tileCount,0);
 assert.ok(!scene.children.includes(world.root));
});
