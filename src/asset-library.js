/**
 * Scene placement for 50 reusable Kenney CC0 meshes, self-hosted at build time.
 * Models are created on approach, not at world initialization and not for every
 * one of the 60 airports. All GLB geometry/textures remain shared and cached.
 */
import {KENNEY_MODELS} from "./asset-manifest.js";
const URL_PREFIX=new URL("../assets/kenney/",import.meta.url);
const key=(pack,name)=>pack+"/"+name;
const CHOICES={
 city:["city-commercial/building-skyscraper-a",
  "city-commercial/building-skyscraper-b",
  "city-commercial/building-skyscraper-c",
  "city-commercial/building-a",
  "city-commercial/building-d",
  "city-commercial/building-h"],
 suburban:["city-suburban/building-type-a",
  "city-suburban/building-type-f",
  "city-suburban/building-type-k"],
 industrial:["city-industrial/building-a",
  "city-industrial/building-f",
  "city-industrial/building-m",
  "city-industrial/detail-tank"],
 trees:["nature/tree_default","nature/tree_detailed",
  "nature/tree_oak","nature/tree_pineDefaultA",
  "nature/tree_pineRoundA","nature/tree_palmDetailedTall"],
 rocks:["nature/rock_largeA","nature/rock_largeC",
  "nature/rock_tallA","nature/rock_smallA"],
 hangars:["space/hangar_largeA","space/hangar_largeB",
  "space/hangar_smallA","space/hangar_roundGlass"],
 detail:["city-roads/light-square","city-roads/light-curved",
  "city-roads/construction-cone"]
};
for(const names of Object.values(CHOICES))for(const name of names)
 if(!KENNEY_MODELS.includes(name))
  throw Error("Asset manifest missing "+name);
const URBAN=new Set(["megacity","futuristic","industrial","historic"]);
const TREE_BIOMES=new Set(["jungle","tropical","meadow","highlands",
 "fjord","alpine","glacial","polar"]);
const SLICE_MAX=15000;
export function planAirportAssets(airport,region,{mobile=false}={}){
 if(!airport||!region)return [];
 let seed=(region.seed^Number(airport.id.slice(3))*0x9e3779b1)>>>0;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)
  /4294967296);
 const items=[],urban=URBAN.has(region.biome)||
  airport.category==="internacional";
 const full=!mobile,cityCount=urban?(full?26:9):0;
 const treeCount=TREE_BIOMES.has(region.biome)?
  full?52:12:full?8:3;
 const rockCount=full?19:6;
 const heading=airport.heading*Math.PI/180;
 const forward={x:Math.sin(heading),z:-Math.cos(heading)};
 const right={x:Math.cos(heading),z:Math.sin(heading)};
 function append(group,count,radiusMin,radiusMax,height,width){
  for(let i=0;i<count;i++){
   const theta=random()*Math.PI*2;
   const distance=radiusMin+random()*(radiusMax-radiusMin);
   const along=Math.cos(theta)*distance,
    lateral=Math.sin(theta)*distance;
   if(Math.abs(lateral)<310&&Math.abs(along)<airport.runways[0].length)
    continue;
   items.push({key:group[i%group.length],
    x:airport.x+right.x*lateral+forward.x*along,
    z:airport.z+right.z*lateral+forward.z*along,
    yaw:random()*Math.PI*2,
    height:height*(.82+random()*.55),
    width:width*(.82+random()*.5)});
  }
 }
 append(CHOICES.hangars,mobile?2:4,450,1000,24,48);
 if(urban)append(region.biome==="industrial"?CHOICES.industrial:
  region.biome==="historic"?CHOICES.suburban:CHOICES.city,
  cityCount,1050,full?3700:2450,region.biome==="megacity"?
    150:region.biome==="futuristic"?160:43,45);
 if(treeCount)append(region.biome==="tropical"?
  [CHOICES.trees[5],CHOICES.trees[0]]:region.biome==="alpine"||
  region.biome==="polar"?[CHOICES.trees[3],CHOICES.trees[4]]:
  CHOICES.trees,treeCount,900,full?3600:2500,18,13);
 append(CHOICES.rocks,rockCount,750,full?3100:1950,14,20);
 append(CHOICES.detail,full?12:3,250,850,7,4);
 return items.slice(0,SLICE_MAX);
}
export function createAssetLibrary(THREE,worldRoot,sampleHeight,{mobile=false}={}){
 let loaderPromise=null,disposed=false,requestId=0;
 const cache=new Map(),modelGroup=new THREE.Group();
 modelGroup.name="Kenney_CC0_Imported_Scenery";
 worldRoot.add(modelGroup);
 let loadedInstances=0,loadedModels=0,lastError="";
 function loader(){
  loaderPromise??=import("../vendor/GLTFLoader.bundle.js")
   .then(module=>new module.GLTFLoader());
  return loaderPromise;
 }
 async function original(name){
  if(!KENNEY_MODELS.includes(name))throw Error("Unknown CC0 model "+name);
  if(!cache.has(name)){
   const promise=loader().then(glb=>glb.loadAsync(
    new URL(name+".glb",URL_PREFIX).href)).then(gltf=>{
     loadedModels++;return gltf.scene;
    });
   cache.set(name,promise);
  }
  return cache.get(name);
 }
 function reset(){
  requestId++;loadedInstances=0;
  // IMPORTANT: do not dispose shared geometry; originals in cache own it.
  modelGroup.clear();
 }
 async function place(airport,region){
  reset();
  const version=requestId;
  const plan=planAirportAssets(airport,region,{mobile});
  const unique=[...new Set(plan.map(item=>item.key))];
  const sources=new Map();
  for(const name of unique){
   if(disposed||version!==requestId)return;
   try{sources.set(name,await original(name))}
   catch(error){lastError=String(error?.message||error).slice(0,180)}
  }
  if(disposed||version!==requestId)return;
  for(const item of plan){
   const source=sources.get(item.key);
   if(!source)continue;
   const clone=source.clone(true);
   const bounds=new THREE.Box3().setFromObject(clone),
    size=bounds.getSize(new THREE.Vector3());
   if(!(size.y>0&&size.x>0&&size.z>0))continue;
   const h=Math.min(240,Math.max(2,item.height));
   const factor=Math.min(h/size.y,item.width/Math.max(size.x,size.z));
   const centre=bounds.getCenter(new THREE.Vector3());
   clone.scale.multiplyScalar(factor);
   clone.rotation.y=item.yaw;
   // Recompute transformed bounds to keep feet ON the actual terrain.
   const realBounds=new THREE.Box3().setFromObject(clone);
   clone.position.set(item.x-realBounds.getCenter(new THREE.Vector3()).x,
    sampleHeight(item.x,item.z)-realBounds.min.y,
    item.z-realBounds.getCenter(new THREE.Vector3()).z);
   clone.traverse(node=>{if(node.isMesh){
    node.castShadow=false;node.receiveShadow=true;
   }});
   modelGroup.add(clone);
   loadedInstances++;
  }
 }
 function dispose(){
  disposed=true;reset();modelGroup.removeFromParent();
  for(const promise of cache.values())promise.then(scene=>{
   const geos=new Set(),materials=new Set(),textures=new Set();
   scene.traverse(node=>{if(node.isMesh){
    if(node.geometry)geos.add(node.geometry);
    const list=Array.isArray(node.material)?node.material:[node.material];
    for(const m of list)if(m)materials.add(m);
   }});
   for(const material of materials)
    for(const value of Object.values(material))
      if(value?.isTexture)textures.add(value);
   for(const geo of geos)geo.dispose();
   for(const tex of textures)tex.dispose();
   for(const mat of materials)mat.dispose();
  }).catch(()=>{});
  cache.clear();
 }
 return {place,reset,dispose,get count(){return loadedInstances},
  get unique(){return loadedModels},get lastError(){return lastError}};
}
