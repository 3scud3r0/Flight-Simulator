/** Algorithms 041–055: deterministic PBR material data and terrain shading decisions. */
import {clamp,lerp,smooth,noise2,hash,norm} from "./math.js";
export function materialByBiome(altitude,humidity,temp,slope){
 const snow=clamp((altitude-2600)/1100+(2-temp)/20),
 desert=clamp((.35-humidity)*3)*clamp(temp/25),
 rock=clamp((slope-.58)*3)*(1-snow),
 vegetation=clamp(humidity*.9)*(1-snow)*(1-desert);
 const sand=desert,soil=(1-snow-rock)*(1-vegetation)*(1-desert);
 const weights={snow,rock,vegetation,sand,soil};const t=Object.values(weights).reduce((a,b)=>a+b,0)||1;
 return Object.fromEntries(Object.entries(weights).map(([k,v])=>[k,v/t]));
}
export function pbrMaterial({albedo=[.5,.5,.5],metallic=0,roughness=.8,ao=1,normal=[0,0,1]}={}){
 return {albedo:albedo.map(v=>clamp(v)),metallic:clamp(metallic),
 roughness:clamp(roughness,.04,1),ao:clamp(ao),normal};
}
export function normalMapFromHeight(height,x,y,step=1,strength=1){
 const dx=(height(x+step,y)-height(x-step,y))/(2*step);
 const dy=(height(x,y+step)-height(x,y-step))/(2*step);
 const n=norm({x:-dx*strength,y:-dy*strength,z:1});return [n.x,n.y,n.z];
}
export function parallaxOcclusion(uv,view,readHeight,{layers=20,scale=.06}={}){
 const steps=Math.max(2,Math.min(128,layers)),delta=scale/steps;
 let p={...uv},depth=0;
 const dir={x:view.x/Math.max(.1,Math.abs(view.z))*delta,
 y:view.y/Math.max(.1,Math.abs(view.z))*delta};
 while(depth<1){if(depth>=readHeight(p.x,p.y))break;
 p.x-=dir.x;p.y-=dir.y;depth+=1/steps}
 return {u:p.x,v:p.y,depth};
}
export function triplanarWeights(normal,sharpness=4){
 const v=[Math.abs(normal.x)**sharpness,Math.abs(normal.y)**sharpness,
 Math.abs(normal.z)**sharpness],sum=v[0]+v[1]+v[2]||1;return v.map(a=>a/sum);
}
export function textureSplat(samples,weights){
 const n=Math.min(samples.length,weights.length);let total=0;
 const c=[0,0,0,0];for(let i=0;i<n;i++){const w=Math.max(0,weights[i]);total+=w;
 for(let k=0;k<4;k++)c[k]+=(samples[i][k]??(k===3?1:0))*w}
 return c.map(v=>v/Math.max(total,1e-9));
}
export function virtualTexturePages(view,mips,pageSize=128,maxPages=2048){
 const pages=[];
 for(let mip=0;mip<Math.min(20,mips)&&pages.length<maxPages;mip++){
 const scale=2**mip,x0=Math.floor(view.left/(pageSize*scale)),
 x1=Math.floor(view.right/(pageSize*scale)),
 y0=Math.floor(view.top/(pageSize*scale)),y1=Math.floor(view.bottom/(pageSize*scale));
 for(let y=y0;y<=y1&&pages.length<maxPages;y++)
 for(let x=x0;x<=x1&&pages.length<maxPages;x++)
 pages.push({mip,x,y,priority:1/(1+mip)})}
 return pages;
}
export function anisotropicLevel(angle,max=16){
 const distortion=1/Math.max(.07,Math.abs(Math.cos(angle)));
 return Math.min(max,Math.max(1,2**Math.ceil(Math.log2(distortion))));
}
export function projectedDecal(point,decal){
 const p={x:point.x-decal.position.x,y:point.y-decal.position.y,z:point.z-decal.position.z};
 const c=Math.cos(-decal.rotation),s=Math.sin(-decal.rotation);
 const x=p.x*c-p.z*s,z=p.x*s+p.z*c;
 return {u:x/decal.width+.5,v:z/decal.length+.5,
 opacity:clamp(1-Math.abs(p.y)/Math.max(.001,decal.depth))*
 (Math.abs(x)<=decal.width/2&&Math.abs(z)<=decal.length/2?1:0)};
}
export function wetnessMaterial(pbr,rain,porosity=.5){
 const wet=clamp(rain*(1-porosity*.6));
 return {...pbr,albedo:pbr.albedo.map(v=>v*(1-.38*wet)),
 roughness:lerp(pbr.roughness,.085,wet),wetness:wet};
}
export function snowAccumulation(normal,altitude,temperature,precipitation){
 return clamp(precipitation*clamp((2-temperature)/9)*
 clamp((normal.y-.15)/.85)*clamp((altitude+100)/300));
}
export function microdetailBlend(base,detail,distance,maxDistance=150){
 const strength=1-smooth(distance/maxDistance);
 return base.map((v,i)=>lerp(v,detail[i]??v,strength));
}
export function seasonalVegetation(dayOfYear,latitude,moisture){
 const phase=2*Math.PI*(dayOfYear/365+(latitude<0?.5:0));
 const summer=(Math.sin(phase-Math.PI/2)+1)/2;
 return {chlorophyll:clamp(.25+.7*summer)*clamp(moisture*1.2),
 autumn:clamp((1-summer)*.7),leafDensity:clamp(.15+.85*summer)};
}
export function ecologicalSpecies(x,z,species,{altitude=0,temp=20,moisture=.5,seed=1}={}){
 const result=[];for(let i=0;i<species.length;i++){
 const s=species[i];const suitability=clamp(1-Math.abs(temp-s.temp)/s.tempRange)*
 clamp(1-Math.abs(moisture-s.moisture)/s.moistureRange)*
 clamp(1-Math.abs(altitude-s.altitude)/s.altitudeRange);
 if(hash(Math.floor(x),Math.floor(z),i,seed)<suitability*(s.density??.5))
 result.push({id:s.id,suitability})}return result;
}
export function impostorSelection(projectedPixels,views=8){
 const size=projectedPixels>120?"mesh":projectedPixels>10?"billboard":"point";
 return {representation:size,viewIndex:((Math.round(projectedPixels)%views)+views)%views};
}
export const algorithms=[materialByBiome,pbrMaterial,normalMapFromHeight,
 parallaxOcclusion,triplanarWeights,textureSplat,virtualTexturePages,
 anisotropicLevel,projectedDecal,wetnessMaterial,snowAccumulation,
 microdetailBlend,seasonalVegetation,ecologicalSpecies,impostorSelection];
