import test from "node:test";
import assert from "node:assert/strict";
import {createAetheriaWorld} from "../src/aetheria.js";
import {AETHERIA_AIRPORTS} from "../src/aetheria-data.js";

class V3 {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
 setScalar(n){return this.set(n,n,n)}
}
class Object3D {
 constructor(){this.children=[];this.position=new V3();this.rotation=new V3();
 this.scale=new V3(1,1,1);this.visible=true;this.matrix={}}
 add(...objects){for(const object of objects){object.removeFromParent?.();
 this.children.push(object);object.parent=this}}
 remove(...objects){for(const object of objects){this.children=this.children.filter(o=>o!==object);
 if(object?.parent===this)object.parent=null}}
 removeFromParent(){this.parent?.remove(this)}
 traverse(callback){callback(this);for(const c of [...this.children])c.traverse(callback)}
 updateMatrix(){this.matrix={position:{...this.position},scale:{...this.scale}}}
}
class Geometry{
 constructor(){this.attributes={};this.disposed=false}
 setAttribute(key,value){this.attributes[key]=value}
 setIndex(values){this.index=values}
 computeVertexNormals(){this.normalsComputed=true}
 dispose(){this.disposed=true}
}
class Attr{constructor(array,size){this.array=array;this.itemSize=size}}
class Color{
 constructor(hex=0xffffff){this.set(hex)}
 set(hex){this.r=((hex>>16)&255)/255;this.g=((hex>>8)&255)/255;
 this.b=(hex&255)/255;return this}
 copy(c){this.r=c.r;this.g=c.g;this.b=c.b;return this}
 lerp(c,t){this.r+=(c.r-this.r)*t;this.g+=(c.g-this.g)*t;
 this.b+=(c.b-this.b)*t;return this}
 multiplyScalar(n){this.r*=n;this.g*=n;this.b*=n;return this}
 setRGB(r,g,b){this.r=r;this.g=g;this.b=b;return this}
}
class Material{
 constructor(options={}){this.color=new Color(options.color??0xffffff);
 Object.assign(this,options)}
 dispose(){this.disposed=true}
}
class Mesh extends Object3D{
 constructor(geometry,material){super();this.isMesh=true;this.geometry=geometry;
 this.material=material}
}
class InstancedMesh extends Mesh{
 constructor(geometry,material,count){super(geometry,material);this.count=count;
 this.instanceMatrix={needsUpdate:false};this.matrices=new Array(count)}
 setMatrixAt(index,matrix){this.matrices[index]=matrix}
}
class Light extends Object3D{
 constructor(){super();this.shadow={mapSize:{set(){}},camera:{}};
 this.target=new Object3D()}
}
class CanvasTexture{
 constructor(canvas){this.canvas=canvas;this.repeat={set(){}};
 this.anisotropy=1}
 dispose(){this.disposed=true}
}
const THREE={
 Group:Object3D,Object3D,Mesh,InstancedMesh,DirectionalLight:Light,
 HemisphereLight:Light,BoxGeometry:Geometry,PlaneGeometry:Geometry,
 SphereGeometry:Geometry,ConeGeometry:Geometry,IcosahedronGeometry:Geometry,
 BufferGeometry:Geometry,Float32BufferAttribute:Attr,
 MeshStandardMaterial:Material,MeshBasicMaterial:Material,
 CanvasTexture,Color,DoubleSide:2,RepeatWrapping:1,SRGBColorSpace:"srgb"
};
const renderer={capabilities:{getMaxAnisotropy:()=>4},
 toneMappingExposure:1};
const oldDocument=globalThis.document;
test("Aetheria progressively streams a bounded world and disposes resources",()=>{
 globalThis.document={
  createElement(tag){
   assert.equal(tag,"canvas");
   return {width:0,height:0,getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData(){}
   })};
  }
 };
 try{
  const scene=new Object3D(),airport=AETHERIA_AIRPORTS[0];
  const world=createAetheriaWorld(THREE,scene,renderer,{
   mobile:true,compatibility:true});
  assert.equal(world.tileLimit,9);
  assert.equal(world.tileCount,0);
  for(let frame=0;frame<65;frame++)
   world.update(airport.x,airport.z,1/60);
  assert.equal(world.tileCount,9);
  assert.equal(world.region.id,airport.regionId);
  assert.equal(world.airports.length,60);
  assert.equal(world.landmarks.length,20);
  assert.ok(world.root.children.some(child=>child.name?.startsWith(
   "Aetheria_Terrain_")));
  world.update(airport.x+200000,airport.z+100000,1/60);
  assert.ok(world.tileCount<=world.tileLimit);
  world.updateEnvironment(21,"nublado",1/60);
  assert.ok(Number.isFinite(world.sun.intensity));
  world.dispose();
  assert.ok(!scene.children.includes(world.root));
  assert.equal(world.tileCount,0);
 }finally{globalThis.document=oldDocument}
});
