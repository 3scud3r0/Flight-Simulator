import {AETHERIA_AIRPORTS,AETHERIA_LANDMARKS,aetheriaRegionAt} from "./aetheria-data.js";

/**
 * Built-in offline Aetheria renderer. It is intentionally inside main.js:
 * even a 404 for /src/legacy/aetheria.js cannot block Lite or destroy the Rio world.
 * Full Aetheria still uses the richer optional renderer when available.
 */
export function createOfflineAetheriaWorld(THREE,scene,renderer,{mobile=false,
 compatibility=true}={}) {
 const root=new THREE.Group();
 root.name="Aetheria_Offline_Lite";
 scene.add(root);
 const tileSize=2400,radius=1,steps=mobile?16:22;
 const tiles=new Map(),materials=new Set();
 const groundMaterial=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.95,
  side:THREE.DoubleSide});
 const seaMaterial=new THREE.MeshStandardMaterial({
  color:0x155774,roughness:.52,metalness:.04});
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(35000,35000),seaMaterial);
 sea.rotation.x=-Math.PI/2;sea.position.y=-.8;root.add(sea);
 const cloudMat=new THREE.MeshBasicMaterial({
  color:0xddeaf1,transparent:true,opacity:.72,depthWrite:false});
 const sun=new THREE.DirectionalLight(0xffe9d0,1.8);
 const hemi=new THREE.HemisphereLight(0xc2e9ff,0x476754,.9);
 sun.castShadow=false;scene.add(sun,sun.target,hemi);
 const runwayGlow=new THREE.MeshBasicMaterial({color:0xf1f3d0,
  opacity:0,transparent:true});
 const runwayMaterial=new THREE.MeshStandardMaterial({
  color:0x38424a,roughness:.93});
 const stripeMaterial=new THREE.MeshBasicMaterial({color:0xf0f2e9});
 const activeStructures=new THREE.Group();
 root.add(activeStructures);
 const nearest=(x,z)=>{
  let best=null,d=Infinity;
  for(const airport of AETHERIA_AIRPORTS){
   const dist=Math.hypot(x-airport.x,z-airport.z);
   if(dist<d){best=airport;d=dist}
  }
  return {airport:best,distance:d};
 };
 const baseHeight=(x,z)=>{
  const region=aetheriaRegionAt(x,z);
  const rolling=60*Math.sin(x*.000046+region.seed)*
   Math.cos(z*.000017-region.seed);
  const ridges=90*Math.abs(Math.sin(x*.000097)*
   Math.cos(z*.000052));
  const alpine=["alpine","glacial","fjord"].includes(region.biome);
  const wet=["ocean","tropical"].includes(region.biome);
  let height=region.elevation+rolling+
    (alpine?7:1)*ridges;
  if(wet)height=-15+
    Math.max(0,Math.sin(x*.000024)+Math.cos(z*.000028))**2*65;
  return Math.max(-80,Math.min(4400,height));
 };
 const sampleHeight=(x,z)=>{
  const origin=nearest(x,z);
  if(origin.distance<5000){
   const a=origin.airport,heading=a.heading*Math.PI/180;
   const dx=x-a.x,dz=z-a.z;
   const along=dx*Math.sin(heading)-dz*Math.cos(heading);
   const lateral=dx*Math.cos(heading)+dz*Math.sin(heading);
   const end=Math.max(0,Math.abs(along)-a.runways[0].length/2-190);
   const side=Math.max(0,Math.abs(lateral)-280);
   const t=Math.max(0,Math.min(1,Math.hypot(end,side)/1550));
   const blend=t*t*(3-2*t);
   return (a.elevation-1)*(1-blend)+baseHeight(x,z)*blend;
  }
  return baseHeight(x,z);
 };
 function clearGroup(group){
  group.traverse(object=>{
   if(object.isMesh)object.geometry?.dispose?.();
  });
  group.clear();
 }
 function airportVisual(a){
  clearGroup(activeStructures);
  const rw=a.runways[0],angle=-rw.heading*Math.PI/180,
   heading=rw.heading*Math.PI/180;
  const runway=new THREE.Mesh(new THREE.BoxGeometry(
   rw.width,.65,rw.length),runwayMaterial);
  runway.position.set(a.x,a.elevation-.5,a.z);
  runway.rotation.y=angle;activeStructures.add(runway);
  const forward={x:Math.sin(heading),z:-Math.cos(heading)};
  for(let d=-rw.length/2+50;d<rw.length/2-30;d+=110){
   const stripe=new THREE.Mesh(new THREE.BoxGeometry(
    1.8,.05,30),stripeMaterial);
   stripe.position.set(a.x+forward.x*d,a.elevation-.12,
    a.z+forward.z*d);
   stripe.rotation.y=angle;activeStructures.add(stripe);
  }
 }
 function makeTile(ix,iz){
  const N=steps,px=[],color=[],idx=[];
  const originX=ix*tileSize,originZ=iz*tileSize;
  for(let row=0;row<=N;row++)for(let col=0;col<=N;col++){
   const x=originX+col/N*tileSize,z=originZ+row/N*tileSize,
    y=sampleHeight(x,z);
   const region=aetheriaRegionAt(x,z);
   const rgb=new THREE.Color(region.landColor);
   if(y<1)rgb.set(0x337f98);
   else if(y>2200)rgb.lerp(new THREE.Color(0xd2e4e9),
    Math.min(1,(y-2200)/900));
   px.push(col/N*tileSize,y,row/N*tileSize);
   color.push(rgb.r,rgb.g,rgb.b);
   if(row<N&&col<N){
    const i=row*(N+1)+col,j=i+N+1;
    idx.push(i,j,i+1,i+1,j,j+1);
   }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",
    new THREE.Float32BufferAttribute(px,3));
  geometry.setAttribute("color",
    new THREE.Float32BufferAttribute(color,3));
  geometry.setIndex(idx);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,groundMaterial);
  mesh.position.set(originX,0,originZ);root.add(mesh);
  tiles.set(ix+":"+iz,mesh);
 }
 let iterations=0,disposed=false,activeAirport="",region=null;
 function update(x,z){
  if(disposed)return;
  const ix=Math.floor(x/tileSize),iz=Math.floor(z/tileSize);
  const wanted=[];
  for(let a=-radius;a<=radius;a++)for(let b=-radius;b<=radius;b++)
   wanted.push({x:ix+a,z:iz+b,d:a*a+b*b});
  wanted.sort((a,b)=>a.d-b.d);
  const keep=new Set(wanted.map(t=>t.x+":"+t.z));
  for(const [key,mesh] of tiles)if(!keep.has(key)){
   root.remove(mesh);mesh.geometry.dispose();tiles.delete(key);
  }
  // No more than one new mesh every five frames.
  if(tiles.size===0||++iterations%5===0){
   for(const tile of wanted)if(!tiles.has(tile.x+":"+tile.z)){
    makeTile(tile.x,tile.z);break;
   }
  }
  sea.position.x=x;sea.position.z=z;
  region=aetheriaRegionAt(x,z);
  const closest=nearest(x,z);
  if(closest.distance<12000&&closest.airport.id!==activeAirport){
   airportVisual(closest.airport);
   activeAirport=closest.airport.id;
  }else if(closest.distance>=12000&&activeAirport){
   clearGroup(activeStructures);activeAirport="";
  }
 }
 function updateEnvironment(hour,weather,dt){
  const sunHeight=Math.max(.03,Math.sin((hour-5)/14*Math.PI));
  sun.intensity=sunHeight*(weather==="nublado"?1.2:2.2);
  hemi.intensity=.2+sunHeight*.8;
  runwayGlow.opacity=sunHeight<.2?.9:0;
  cloudMat.opacity=weather==="nublado"?.91:.7;
 }
 function dispose(){
  if(disposed)return;
  disposed=true;
  for(const mesh of tiles.values())mesh.geometry.dispose();
  tiles.clear();clearGroup(activeStructures);
  root.removeFromParent();sea.geometry.dispose();
  for(const material of [groundMaterial,seaMaterial,
   cloudMat,runwayGlow,runwayMaterial,stripeMaterial])
   material.dispose();
  scene.remove(sun,sun.target,hemi);
 }
 return {root,sun,hemi,sea,cloudMat,runwayGlow,
  airports:AETHERIA_AIRPORTS,landmarks:AETHERIA_LANDMARKS,
  sampleHeight,update,updateEnvironment,dispose,
  setRealTerrainEnabled(){},
  get tileCount(){return tiles.size},
  get tileLimit(){return 9},
  get region(){return region},
  get status(){return "Aetheria leve · "+
    (region?.name||"megaplaneta")+" · terreno offline"}
 };
}
