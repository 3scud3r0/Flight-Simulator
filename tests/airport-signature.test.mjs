import test from "node:test";
import assert from "node:assert/strict";
import {AETHERIA_AIRPORTS} from "../src/aetheria-data.js";
import {planAirportSignature,createAirportSignature}
 from "../src/airport-signature.js";

class Node{
 constructor(){this.children=[];this.position={set:(...v)=>{this.p=v}};
  this.rotation={};}
 add(child){this.children.push(child);child.parent=this}
 removeFromParent(){
  if(this.parent)this.parent.children=
   this.parent.children.filter(child=>child!==this);
  this.parent=null;
 }
}
class Geo{
 constructor(...dimensions){this.dimensions=dimensions;this.disposed=false}
 dispose(){this.disposed=true}
}
class Mat{
 constructor(options){Object.assign(this,options);this.disposed=false}
 dispose(){this.disposed=true}
}
class Mesh extends Node{
 constructor(geo,material){super();this.geometry=geo;this.material=material}
}
const THREE={
 Group:Node,Mesh,BoxGeometry:Geo,
 MeshStandardMaterial:Mat,MeshBasicMaterial:Mat
};

test("all four airports receive reproducible region-distinct structures",()=>{
 const plans=AETHERIA_AIRPORTS.map(a=>planAirportSignature(a));
 for(let i=0;i<AETHERIA_AIRPORTS.length;i++){
  const airport=AETHERIA_AIRPORTS[i],p=plans[i];
  assert.deepEqual(p,planAirportSignature(airport));
  assert.ok(p.terminal.height>0&&p.tower.height>p.terminal.height);
  assert.ok(p.bridgeFrom<p.bridgeTo);
  assert.ok(p.terminal.right>airport.runways[0].width/2+350);
  assert.ok(p.connections.length>0);
  assert.ok(p.connections.every(back=>
   Math.abs(back)<p.terminal.length/2));
 }
 assert.equal(new Set(plans.map(p=>p.accents)).size,4);
 assert.throws(()=>planAirportSignature(null),TypeError);
});

test("terminal geometry respects airport rotation and disposable ownership",()=>{
 for(const airport of AETHERIA_AIRPORTS){
  const parent=new Node();
  const detail=createAirportSignature(THREE,parent,airport);
  assert.equal(parent.children.length,1);
  assert.equal(detail.root.name,"Aetheria_Signature_"+airport.id);
  assert.deepEqual(detail.root.p,
   [airport.x,airport.elevation-.12,airport.z]);
  assert.ok(detail.root.children.length>=13);
  const names=detail.root.children.map(x=>x.name);
  for(const name of ["terminal-main","terminal-roof",
   "terminal-glass-airside","tower-stem","tower-beacon",
   "passenger-bridge"])
   assert.ok(names.includes(name),airport.id+": "+name);
  const geometry=detail.root.children[0].geometry;
  const material=detail.root.children[0].material;
  detail.setDaylight(0);
  detail.setDaylight(1);
  detail.dispose();
  assert.equal(parent.children.length,0);
  assert.equal(geometry.disposed,true);
  assert.equal(material.disposed,true);
  detail.dispose(); // double-disposal is safe
 }
});

test("compatibility mode does not allocate terminal geometry",()=>{
 const parent=new Node();
 const detail=createAirportSignature(THREE,parent,
  AETHERIA_AIRPORTS[0],{compatibility:true});
 assert.equal(parent.children.length,0);
 detail.setDaylight(.5);detail.dispose();
});
