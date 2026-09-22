/**
 * Aetheria Compact — a 48 x 36 km fictional peninsula / island chain.
 * This is a focused playable level, not an inventory of placeholder airports.
 * Coordinates are local metres, NOT GPS or ICAO codes.
 */
export const AETHERIA_SIZE=Object.freeze({width:48000,height:36000});
const regionSpec=[
 ["nova-iris","Nova Íris","megacity",-11700,-8600,23,0x849d8b,0x225774,23],
 ["auralis","Auralis","tropical",11600,-8600,10,0xbab18b,0x14758d,29],
 ["vertice","Vértice","alpine",-11700,8500,590,0x84927e,0x344d60,6],
 ["viridia","Virídia","jungle",11600,8500,160,0x4d8160,0x29645f,27]
];
export const AETHERIA_REGIONS=Object.freeze(regionSpec.map(
 ([id,name,biome,x,z,elevation,landColor,waterColor,temperature],index)=>
 Object.freeze({id,name,biome,x,z,elevation,landColor,waterColor,
  temperature,index,radius:17000,seed:1977+index*73})
));
const specs=[
 ["AE-01","Nova Íris Internacional","nova-iris",-11100,-8300,
  "internacional",24,72,2900,50],
 ["AE-02","Auralis Costeiro","auralis",11500,-8100,
  "regional",9,310,1600,35],
 ["AE-03","Vale Vértice","vertice",-11500,8300,
  "regional",580,128,1650,32],
 ["AE-04","Clareira Virídia","viridia",11900,8400,
  "especial",165,231,1150,28]
];
export const AETHERIA_AIRPORTS=Object.freeze(specs.map(
 ([id,name,regionId,x,z,category,elevation,heading,length,width])=>{
 const region=AETHERIA_REGIONS.find(r=>r.id===regionId);
 const direction=Math.round(heading/10)%36;
 return Object.freeze({id,name,regionId,regionName:region.name,
  category,x,z,lat:z,lon:x,elevation,heading,
  runways:[{name:String(direction).padStart(2,"0")+
   " / "+String((direction+18)%36).padStart(2,"0"),
   length,width,heading,offset:0}],
  type:"pista"});
}));
export const AETHERIA_LANDMARKS=Object.freeze(AETHERIA_REGIONS.map(r=>
 Object.freeze({id:"LM-"+String(r.index+1).padStart(2,"0"),
 name:r.name+" · Região",regionId:r.id,x:r.x,z:r.z,
 lat:r.z,lon:r.x,height:r.elevation+650})));
export const AETHERIA_CENTRAL_AIRPORT="AE-01";
export function aetheriaRegionAt(x,z){
 let region=AETHERIA_REGIONS[0],distance=Infinity;
 for(const r of AETHERIA_REGIONS){
  const d=(x-r.x)**2+(z-r.z)**2;
  if(d<distance){distance=d;region=r}
 }
 return region;
}
export function aetheriaAirportById(id){
 return AETHERIA_AIRPORTS.find(a=>a.id===id)||AETHERIA_AIRPORTS[0];
}
export function aetheriaNearestAirport(x,z,maxDistance=Infinity){
 let airport=null,distance=maxDistance;
 for(const a of AETHERIA_AIRPORTS){
  const d=Math.hypot(x-a.x,z-a.z);
  if(d<distance){distance=d;airport=a}
 }
 return airport;
}
