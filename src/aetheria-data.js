/**
 * Aetheria: an entirely fictional game world.
 * All locations, airport codes, coordinates, distances and terrain are invented.
 * Coordinates are world metres: X=east, Z=south. No real ICAO codes.
 * No third-party terrain, photography, credentials or network requests.
 */
export const AETHERIA_SIZE=Object.freeze({width:3200000,height:2400000});
const raw=[
 // 5 columns x 4 rows; 20 contiguous climate/visual domains.
 ["borealis","Borealis","polar",-1280000,-900000,410,0xacc3cd,0x48647a,-16],
 ["skadia","Skadia","glacial",-640000,-900000,680,0xd9e7e8,0x7293a8,-13],
 ["nordalen","Nørdalen","fjord",0,-900000,940,0x71969a,0x274e60,1],
 ["vertice","Vértice","alpine",640000,-900000,1900,0x9eaab2,0x34455b,-5],
 ["luminia","Lúmina","meadow",1280000,-900000,260,0xa2aa77,0x5d834b,10],
 ["viridia","Virídia","jungle",-1280000,-300000,340,0x286947,0x123d37,15],
 ["miragem","Miragem","delta",-640000,-300000,55,0x628e62,0x356c69,8],
 ["eon","Eón","highlands",0,-300000,780,0x729a6c,0x456751,12],
 ["caliope","Calíope","historic",640000,-300000,150,0xbba98a,0x6e8c91,6],
 ["nova-iris","Nova Íris","megacity",1280000,-300000,65,0x81949c,0x345168,5],
 ["auralis","Auralis","tropical",-1280000,300000,30,0x54ac9b,0x12799a,3],
 ["pelagia","Pelágia","ocean",-640000,300000,18,0x259eaa,0x115878,2],
 ["tempestaria","Tempestária","storm",0,300000,90,0x486c83,0x234558,7],
 ["ferrum","Ferrum","industrial",640000,300000,100,0x7e8a89,0x405760,8],
 ["neon-prime","Neon Prime","futuristic",1280000,300000,230,0x7067a5,0x3f336d,12],
 ["sahr","Sahr","desert",-1280000,900000,530,0xd2a66e,0x9b694d,37],
 ["helion","Helion","canyon",-640000,900000,1120,0xa05c42,0x6f3f39,14],
 ["obsidiana","Obsidiana","volcanic",0,900000,410,0x4e4446,0x513839,8],
 ["kharon","Kharon","volcano",640000,900000,900,0x614a45,0x613e34,12],
 ["aether","Aether","fantasy",1280000,900000,1460,0x7482c1,0x655292,10]
];
export const AETHERIA_REGIONS=Object.freeze(raw.map(
 ([id,name,biome,x,z,elevation,landColor,waterColor,temperature],index)=>
 Object.freeze({id,name,biome,x,z,elevation,landColor,waterColor,
 temperature,index,
 // Biome radius is intentionally broader than the centre-to-centre distance:
 // neighboring regions blend continuously with no hard world boundaries.
 radius:420000,seed:1977+index*73})
));
const airfields=[
 ["Nova Íris Internacional","Porto Celeste","Ilha Central"],
 ["Auralis Internacional","Enseada Safira","Atol do Vento"],
 ["Vale Vértice","Platô Alto","Ninho das Águias"],
 ["Kharon Costa","Monte Cinza","Base Caldeira"],
 ["Sahr Internacional","Cidade-Oásis","Salar Vesper"],
 ["Fiorde Central","Lago Norte","Pista do Penhasco"],
 ["Virídia Internacional","Rio das Brumas","Clareira Esmeralda"],
 ["Porto Tempestade","Ilha do Farol","Rocha do Trovão"],
 ["Borealis Central","Aurora Norte","Campo de Gelo"],
 ["Calíope Internacional","Costa Antiga","Ilha das Pontes"],
 ["Delta Central","Porto dos Rios","Hidroporto Manguezal"],
 ["Ferrum Internacional","Costa Industrial","Plataforma Ômega"],
 ["Eón Internacional","Lago Verde","Serra Dourada"],
 ["Neon Prime Internacional","Distrito Vertical","Pista Elevada Sete"],
 ["Helion Vale","Portal Vermelho","Fundo do Cânion"],
 ["Skadia Central","Baía Glacial","Base Iceberg"],
 ["Atol Pelágia","Mar Aberto","Cidade Flutuante"],
 ["Lúmina Regional","Vila Lavanda","Campo das Colinas"],
 ["Costa Negra","Lago Mineral","Cratera Silenciosa"],
 ["Portal Aether","Terraço Celeste","Ilha Suspensa"]
];
const airRegions=["nova-iris","auralis","vertice","kharon","sahr",
 "nordalen","viridia","tempestaria","borealis","caliope",
 "miragem","ferrum","eon","neon-prime","helion",
 "skadia","pelagia","luminia","obsidiana","aether"];
const international=new Set([1,4,13,19,28,34,37,40]);
export const AETHERIA_AIRPORTS=Object.freeze(airfields.flatMap((names,g)=>
 names.map((name,j)=>{
 const number=g*3+j+1,region=AETHERIA_REGIONS.find(r=>r.id===airRegions[g]);
 const special=j===2,code="AE-"+String(number).padStart(2,"0");
 const offsets=[[-36000,-22000],[28000,25000],[12000,-36000]][j];
 const x=region.x+offsets[0],z=region.z+offsets[1];
 const heading=(23+number*37)%360,category=international.has(number)?
 "internacional":special?"especial":"regional";
 const length=special?650:category==="internacional"?3400:region.biome==="alpine"?1050:1800;
 const elevation=Math.max(3,region.elevation+(special?85:j===1?35:0));
 return Object.freeze({
  id:code,name,regionId:region.id,regionName:region.name,category,
  x,z,lat:z,lon:x,elevation,heading,
  runways:[{name:String(Math.round(heading/10)).padStart(2,"0")+
    " / "+String((Math.round(heading/10)+18)%36).padStart(2,"0"),
    length,width:special?28:category==="internacional"?55:36,
    heading,offset:0}],
  // Runway altitudes are authored for the fictitious terrain, not real charts.
  type:special&&["miragem","pelagia"].includes(region.id)?"hidroporto":
    special&&["borealis","skadia"].includes(region.id)?"pista polar":"pista"
 });
})));
export const AETHERIA_LANDMARKS=Object.freeze(AETHERIA_REGIONS.map(r=>
 Object.freeze({id:"LM-"+String(r.index+1).padStart(2,"0"),
 name:r.name+" · Centro da região",regionId:r.id,x:r.x,z:r.z,
 lat:r.z,lon:r.x,height:r.elevation+1200})));
export const AETHERIA_CENTRAL_AIRPORT=AETHERIA_AIRPORTS[0].id;
export function aetheriaRegionAt(x,z){
 let best=AETHERIA_REGIONS[0],distance=Infinity;
 for(const r of AETHERIA_REGIONS){
 const d=(x-r.x)**2+(z-r.z)**2;
 if(d<distance){distance=d;best=r}
 }return best;
}
export function aetheriaAirportById(id){
 return AETHERIA_AIRPORTS.find(a=>a.id===id) || AETHERIA_AIRPORTS[0];
}
export function aetheriaNearestAirport(x,z,maxDistance=Infinity){
 let best=null,distance=maxDistance;
 for(const a of AETHERIA_AIRPORTS){
 const d=Math.hypot(x-a.x,z-a.z);
 if(d<distance){distance=d;best=a}
 }return best;
}
