/**
 * Deterministic, dependency-free Aetheria scenery planner.
 * Geometry is deliberately absent here: the same seed and world coordinates
 * always produce the same placement on all devices and after tile eviction.
 */
import {AETHERIA_AIRPORTS,aetheriaRegionAt} from "./aetheria-data.js";
import {planUrbanGridTile,isStreetCorridor} from "./urban-grid.js";

export const SCENERY_CELL = 2400;
const CITY_X = -11700, CITY_Z = -8600;
const LOT = 180;
const within = (v,low,high) => v>=low && v<high;

/** Stable 32-bit spatial hash; returns a reproducible value in [0,1). */
export function spatialHash(x,z,salt=1){
 let n=(Math.imul(x,374761393)^Math.imul(z,668265263)^
  Math.imul(salt,1442695041))|0;
 n=Math.imul(n^(n>>>13),1274126177);
 return ((n^(n>>>16))>>>0)/4294967296;
}

/** Keep structures, trees and rocks outside aircraft operating surfaces. */
export function isAirportClear(x,z,airports=AETHERIA_AIRPORTS){
 for(const airport of airports){
  const dx=x-airport.x,dz=z-airport.z;
  if(dx*dx+dz*dz>3600*3600)continue;
  const a=airport.heading*Math.PI/180;
  const along=dx*Math.sin(a)-dz*Math.cos(a);
  const lateral=dx*Math.cos(a)+dz*Math.sin(a);
  if(Math.abs(along)<airport.runways[0].length/2+390 &&
    Math.abs(lateral)<660)return false;
  if(Math.hypot(dx,dz)<560)return false;
 }
 return true;
}

/**
 * Plans one 2.4 km square in metres. Does not allocate any GPU resource.
 * Each tile is bounded independently: expansion never grows resident memory.
 */
export function planSceneryTile(ix,iz,{
 sampleHeight,regionAt=aetheriaRegionAt,airports=AETHERIA_AIRPORTS,
 mobile=false,compatibility=false
}={}){
 if(!Number.isSafeInteger(ix)||!Number.isSafeInteger(iz))
  throw new RangeError("Tile indices must be safe integers");
 if(typeof sampleHeight!=="function")
  throw new TypeError("sampleHeight must be a function");
 const startX=ix*SCENERY_CELL,startZ=iz*SCENERY_CELL;
 const buildings=[],trees=[],rocks=[];
 if(compatibility)return {buildings,trees,rocks};
 const {roads,lamps}=planUrbanGridTile(ix,iz,{
  sampleHeight,regionAt,clearance:(x,z)=>
   Math.abs(x)<24000&&Math.abs(z)<18000&&
   isAirportClear(x,z,airports),mobile
 });
 const inWorld=(x,z)=>Math.abs(x)<24000&&Math.abs(z)<18000;
 const heightAt=(x,z)=>{
  const y=sampleHeight(x,z);
  return Number.isFinite(y)&&y>2?y:null;
 };
 const safe=(x,z)=>inWorld(x,z)&&isAirportClear(x,z,airports);
 const region=regionAt(startX+SCENERY_CELL/2,startZ+SCENERY_CELL/2);
 const urban=region.biome==="megacity";

 // City lots use a global lattice, not tile-local random locations. There
 // are no double buildings or visible resets along the tile boundaries.
 if(urban){
  const minX=Math.floor(startX/LOT)-1,maxX=Math.ceil((startX+SCENERY_CELL)/LOT);
  const minZ=Math.floor(startZ/LOT)-1,maxZ=Math.ceil((startZ+SCENERY_CELL)/LOT);
  for(let gx=minX;gx<=maxX;gx++)for(let gz=minZ;gz<=maxZ;gz++){
   const x=gx*LOT+LOT*.5+(spatialHash(gx,gz,11)-.5)*34;
   const z=gz*LOT+LOT*.5+(spatialHash(gx,gz,12)-.5)*34;
   if(!within(x,startX,startX+SCENERY_CELL)||
      !within(z,startZ,startZ+SCENERY_CELL)||!safe(x,z))continue;
   const distance=Math.hypot(x-CITY_X,z-CITY_Z);
   if(distance>8700)continue;
   const density=.84*Math.max(0,1-distance/14500);
   if(spatialHash(gx,gz,13)>density*(mobile?.52:1))continue;
   const y=heightAt(x,z);
   if(y===null||Math.abs(sampleHeight(x+18,z)-y)>11||
      Math.abs(sampleHeight(x,z+18)-y)>11)continue;
   const core=Math.max(0,1-distance/8700);
   const height=12+Math.pow(spatialHash(gx,gz,14),2)*
    (32+core*155);
   const width=23+spatialHash(gx,gz,15)*37;
   const depth=21+spatialHash(gx,gz,16)*38;
   const tint=[0x9bacb7,0x748e9d,0xb9b9a9,0x8aa7ae,0x9b9da9][
    Math.floor(spatialHash(gx,gz,17)*5)];
   buildings.push({x,y,z,width,depth,height,tint,
    kind:height>70?"tower":"lowrise"});
  }
 }

 const seed=(Math.imul(ix,1597334677)^Math.imul(iz,3812015801)^1977)>>>0;
 let state=seed;
 const rand=()=>{
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  return state/4294967296;
 };
 const biome=region.biome;
 const baseCount=biome==="jungle"?210:biome==="tropical"?170:
  biome==="alpine"?135:urban?34:80;
 const attempts=Math.floor(baseCount*(mobile?.36:1));
 for(let i=0;i<attempts;i++){
  const x=startX+rand()*SCENERY_CELL,z=startZ+rand()*SCENERY_CELL;
  if(!safe(x,z))continue;
  if(urban&&isStreetCorridor(x,z))continue;
  const y=heightAt(x,z);
  if(y===null)continue;
  if(urban&&Math.hypot(x-CITY_X,z-CITY_Z)<8600&&rand()<.64)
   continue;
  const slope=Math.max(Math.abs(sampleHeight(x+18,z)-y),
   Math.abs(sampleHeight(x,z+18)-y));
  if(slope>13||y>2900)continue;
  const evergreen=biome==="alpine";
  const height=(evergreen?13:10)+rand()*(evergreen?17:14);
  trees.push({x,y,z,height,radius:height*(evergreen?.23:.36),
   evergreen,tint:evergreen?
    [0x315744,0x406650,0x52705a][Math.floor(rand()*3)]:
    [0x47794b,0x62884d,0x396a43,0x729456][Math.floor(rand()*4)]});
 }
 if(biome==="alpine"||biome==="jungle"){
  const attemptsRock=mobile?9:28;
  for(let i=0;i<attemptsRock;i++){
   const x=startX+rand()*SCENERY_CELL,z=startZ+rand()*SCENERY_CELL;
   if(!safe(x,z))continue;
   const y=heightAt(x,z);
   if(y===null)continue;
   const size=4+rand()*21;
   rocks.push({x,y,z,size,tint:biome==="alpine"?0x777b79:0x5d7163});
  }
 }
 return {buildings,trees,rocks,roads,lamps};
}
