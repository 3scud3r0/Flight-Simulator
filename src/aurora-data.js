/** Ilhas de Aurora — original, deterministic 12 × 10 km archipelago. Metres; X east, Y up, Z south. */
export const AURORA_SIZE=Object.freeze({width:12000,height:10000});
export const AURORA_AIRPORTS=Object.freeze([Object.freeze({
 id:"AU-01",name:"Aeródromo da Aurora",regionId:"aurora",regionName:"Ilhas de Aurora",
 category:"regional",x:150,z:-200,lat:-200,lon:150,elevation:16,
 heading:42,runways:[Object.freeze({name:"04 / 22",length:1100,width:32,heading:42,offset:0})],type:"pista"
})]);
export const AURORA_LANDMARKS=Object.freeze([
 {id:"AU-L1",name:"Farol do Leste",regionId:"aurora",x:4280,z:-650,lat:-650,lon:4280,height:100},
 {id:"AU-L2",name:"Ponte dos Arcos",regionId:"aurora",x:2440,z:-650,lat:-650,lon:2440,height:45},
 {id:"AU-L3",name:"Vila da Enseada",regionId:"aurora",x:-950,z:880,lat:880,lon:-950,height:50},
 {id:"AU-L4",name:"Mirante do Cedro",regionId:"aurora",x:-1530,z:-390,lat:-390,lon:-1530,height:250},
 {id:"AU-L5",name:"Ilha dos Ventos",regionId:"aurora",x:-1150,z:-3500,lat:-3500,lon:-1150,height:145}
].map(Object.freeze));
export const AIRPORTS=AURORA_AIRPORTS, LANDMARKS=AURORA_LANDMARKS;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
const peaks=[[-1470,-440,175,680,520],[870,1090,68,900,520],[3490,-850,165,530,440],[-1080,-3510,125,530,520],[-3910,-250,90,460,420],[-480,3510,66,430,420]];
/** Analytic height shared by visual terrain and aircraft collision. Never random per call. */
export function sampleAuroraHeight(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return -18;
 const islands=[[0,0,2450,1850],[3670,-650,1180,1100],[-1150,-3450,980,770],[-3980,-250,820,730],[-520,3520,840,720]];
 let coast=-Infinity;
 for(const [cx,cz,rx,rz] of islands){
  const dx=(x-cx)/rx,dz=(z-cz)/rz;
  const warp=.038*Math.sin(x*.0031+Math.cos(z*.0019))+.029*Math.sin(z*.0042-x*.0013);
  coast=Math.max(coast,1-Math.hypot(dx,dz)+warp);
 }
 const land=smooth(-.065,.10,coast);
 let h=-18+land*(35+8*Math.sin(x*.0018)*Math.cos(z*.0014)+
  2.6*Math.sin(x*.014+z*.008)*Math.cos(z*.013-x*.005));
 for(const [cx,cz,height,rx,rz] of peaks){
  const d=((x-cx)/rx)**2+((z-cz)/rz)**2;
  h+=land*height*Math.exp(-2.4*d);
 }
 // The entire approach, runway and apron share a level ground plane.
 const heading=42*Math.PI/180,dx=x-150,dz=z+200;
 const along=dx*Math.sin(heading)-dz*Math.cos(heading);
 const side=dx*Math.cos(heading)+dz*Math.sin(heading);
 const beyond=Math.max(0,Math.abs(along)-715);
 const lateral=Math.max(0,Math.abs(side)-205);
 const blend=smooth(0,450,Math.hypot(beyond,lateral));
 h=14.95*(1-blend)+h*blend;
 return Math.max(-25,Math.min(430,h));
}
