/**
 * GPU-batched, bounded scenery for Aetheria's full renderer.
 * Pure placement lives in scenery-plan.js; no WebGL work occurs in tests of
 * world geography. Never load this module from Aetheria Lite or the Rio.
 */
import {planSceneryTile,SCENERY_CELL} from "./scenery-plan.js";

function facadeTextures(THREE){
 if(typeof document==="undefined")return [];
 const canvas=document.createElement("canvas");
 canvas.width=64;canvas.height=128;
 const ctx=canvas.getContext("2d");
 if(!ctx||typeof ctx.fillRect!=="function")return [];
 const glow=document.createElement("canvas");
 glow.width=64;glow.height=128;
 const lit=glow.getContext("2d");
 if(!lit||typeof lit.fillRect!=="function")return [];
 ctx.fillStyle="#bacbd5";ctx.fillRect(0,0,64,128);
 lit.fillStyle="#000000";lit.fillRect(0,0,64,128);
 for(let row=0;row<12;row++)for(let col=0;col<5;col++){
  const x=3+col*12,y=3+row*10;
  const light=(row*13+col*17)%7<3;
  ctx.fillStyle=light?"#c4c9bf":"#36566b";
  ctx.fillRect(x,y,7,6);
  if(light){
   lit.fillStyle=(col+row)%3?"#e8bb84":"#a9cfe5";
   lit.fillRect(x,y,7,6);
  }
 }
 const map=new THREE.CanvasTexture(canvas);
 const emissiveMap=new THREE.CanvasTexture(glow);
 for(const texture of [map,emissiveMap]){
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(2,3);
 }
 return [map,emissiveMap];
}

/**
 * CPU/GPU budget: at most a 5x5 ring of independently removable scenery
 * batches on desktop, 3x3 on mobile, and zero meshes in compatibility mode.
 */
export function createSceneryLayer(THREE,worldRoot,sampleHeight,{
 mobile=false,compatibility=false
}={}){
 const root=new THREE.Group();
 root.name="Aetheria_Cinematic_Scenery";
 worldRoot.add(root);
 const tiles=new Map();
 const geometries={
  building:new THREE.BoxGeometry(1,1,1),
  trunk:new THREE.BoxGeometry(1,1,1),
  broadleaf:new THREE.IcosahedronGeometry(1,1),
  evergreen:new THREE.ConeGeometry(1,1,7),
  rock:new THREE.IcosahedronGeometry(1,0),
  bulb:new THREE.SphereGeometry(1,6,4)
 };
 const textures=facadeTextures(THREE);
 const buildingMat=new THREE.MeshStandardMaterial({
  color:0xffffff,map:textures[0]||null,emissive:0xf8bd7b,
  emissiveMap:textures[1]||null,emissiveIntensity:.035,
  roughness:.72,metalness:.12
 });
 const materials={
  building:buildingMat,
  road:new THREE.MeshStandardMaterial({
   color:0x293039,roughness:.97,metalness:0}),
  lampPost:new THREE.MeshStandardMaterial({
   color:0x727d86,roughness:.75,metalness:.35}),
  lampBulb:new THREE.MeshBasicMaterial({
   color:0xffdd9c,transparent:true,opacity:.02,toneMapped:false}),
  trunk:new THREE.MeshStandardMaterial({
   color:0x755c43,roughness:1}),
  foliage:new THREE.MeshStandardMaterial({
   color:0xffffff,roughness:.95,side:THREE.DoubleSide}),
  rock:new THREE.MeshStandardMaterial({
   color:0xffffff,roughness:.97})
 };
 const dummy=new THREE.Object3D();
 const color=new THREE.Color();
 let ticks=0,count=0,disposed=false;

 function instanced(group,items,geometry,material,place,tint){
  if(!items.length)return;
  const mesh=new THREE.InstancedMesh(geometry,material,items.length);
  mesh.frustumCulled=false;
  mesh.castShadow=false;
  mesh.receiveShadow=true;
  for(let i=0;i<items.length;i++){
   const item=items[i];
   place(item);
   dummy.updateMatrix();
   mesh.setMatrixAt(i,dummy.matrix);
   if(tint&&typeof mesh.setColorAt==="function"){
    color.set(item.tint);
    mesh.setColorAt(i,color);
   }
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  group.add(mesh);
 }
 function build(ix,iz){
  const plan=planSceneryTile(ix,iz,{
   sampleHeight,mobile,compatibility
  });
  const group=new THREE.Group();
  group.name="Aetheria_Scenery_"+ix+":"+iz;
  const towers=plan.buildings.filter(item=>item.kind==="tower");
  const lowrise=plan.buildings.filter(item=>item.kind!=="tower");
  const building=item=>{
   dummy.position.set(item.x,item.y+item.height/2,item.z);
   dummy.rotation.set(0,0,0);
   dummy.scale.set(item.width,item.height,item.depth);
  };
  for(const items of [towers,lowrise])
   instanced(group,items,geometries.building,materials.building,
    building,true);

  instanced(group,plan.trees,geometries.trunk,materials.trunk,item=>{
   dummy.position.set(item.x,item.y+item.height*.26,item.z);
   dummy.rotation.set(0,0,0);
   dummy.scale.set(item.radius*.21,item.height*.52,item.radius*.21);
  });
  for(const evergreen of [true,false]){
   const trees=plan.trees.filter(item=>item.evergreen===evergreen);
   instanced(group,trees,evergreen?geometries.evergreen:
    geometries.broadleaf,materials.foliage,item=>{
    dummy.position.set(item.x,item.y+item.height*.72,item.z);
    dummy.rotation.set(0,0,0);
    dummy.scale.set(item.radius,item.height*.65,item.radius);
   },true);
  }
  // A coherent city silhouette needs streets as well as tower silhouettes.
  // Section surfaces are visual only; no collision plane is introduced.
  instanced(group,plan.roads,geometries.building,materials.road,item=>{
   dummy.position.set(item.x,item.y,item.z);
   dummy.rotation.set(0,0,0);
   dummy.scale.set(item.axis==="x"?item.length:item.width,
    .20,item.axis==="z"?item.length:item.width);
  });
  instanced(group,plan.lamps,geometries.trunk,materials.lampPost,item=>{
   dummy.position.set(item.x,item.y+item.height*.5,item.z);
   dummy.rotation.set(0,0,0);
   dummy.scale.set(.20,item.height,.20);
  });
  instanced(group,plan.lamps,geometries.bulb,materials.lampBulb,item=>{
   dummy.position.set(item.x,item.y+item.height,item.z);
   dummy.rotation.set(0,0,0);
   dummy.scale.set(1.25,1.25,1.25);
  });
  instanced(group,plan.rocks,geometries.rock,materials.rock,item=>{
   dummy.position.set(item.x,item.y+item.size*.3,item.z);
   dummy.rotation.set(0,0,0);
   dummy.scale.set(item.size,item.size*.65,item.size*.8);
  },true);
  root.add(group);
  const objects=plan.buildings.length+plan.trees.length+
   plan.rocks.length+plan.roads.length+plan.lamps.length;
  tiles.set(ix+":"+iz,{group,objects});
  count+=objects;
 }
 function evict(key){
  const tile=tiles.get(key);
  if(!tile)return;
  // Shared materials/geometries remain alive until layer.dispose().
  tile.group.traverse(node=>{
   if(typeof node.dispose==="function"&&
    typeof node.setMatrixAt==="function")node.dispose();
  });
  tile.group.removeFromParent();
  count-=tile.objects;
  tiles.delete(key);
 }
 function update(x,z,terrainTiles){
  if(disposed||compatibility)return;
  const ix=Math.floor(x/SCENERY_CELL);
  const iz=Math.floor(z/SCENERY_CELL);
  const radius=mobile?1:2;
  const wanted=[];
  for(let dz=-radius;dz<=radius;dz++)
   for(let dx=-radius;dx<=radius;dx++){
    const tx=ix+dx,tz=iz+dz,key=tx+":"+tz;
    if(!terrainTiles.has(key))continue;
    wanted.push({ix:tx,iz:tz,key,d:dx*dx+dz*dz});
   }
  const keep=new Set(wanted.map(item=>item.key));
  for(const key of tiles.keys())if(!keep.has(key))evict(key);
  // Build one batch per several frames rather than blocking the input loop.
  if(++ticks%(mobile?12:7)!==1)return;
  wanted.sort((a,b)=>a.d-b.d);
  const next=wanted.find(item=>!tiles.has(item.key));
  if(next)build(next.ix,next.iz);
 }
 function setDaylight(daylight){
  // Night-time window glow is bounded; the map itself remains neutral.
  const night=Math.pow(1-Math.max(0,Math.min(1,daylight)),2);
  buildingMat.emissiveIntensity=.035+.88*night;
  materials.lampBulb.opacity=.02+.98*night;
 }
 function dispose(){
  disposed=true;
  for(const key of [...tiles.keys()])evict(key);
  root.removeFromParent();
  for(const geometry of Object.values(geometries))geometry.dispose();
  for(const material of Object.values(materials))material.dispose();
  for(const texture of textures)texture.dispose();
 }
 return {root,update,setDaylight,dispose,
  get count(){return count},
  get tileCount(){return tiles.size}};
}
