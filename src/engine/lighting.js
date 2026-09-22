/** Algorithms 056–074: physically motivated light transport building blocks.
 * Numerical CPU fallbacks and render-pass kernels: not full real-time GPU integrations. */
import {solarPosition} from "../atmosphere.js";
import {clamp,lerp,vec,dot,norm,sub,add,mul,hash} from "./math.js";
export function solarEphemeris(date,lat,lon){return solarPosition(date,lat,lon)}
export function lunarEphemeris(date,lat,lon){
 const sun=solarPosition(date,lat,lon),days=(date.getTime()-Date.UTC(2000,0,6,18))/86400000;
 const phase=((days/29.530588853)%1+1)%1,angle=2*Math.PI*phase;
 const az=(sun.azimuthDeg+180+25*Math.sin(angle)+360)%360,
 elevation=-sun.elevationDeg+5*Math.sin(angle);
 return {phase,illuminatedFraction:(1-Math.cos(angle))/2,
 azimuthDeg:az,elevationDeg:elevation};
}
export function rayleighScattering(wavelengthNm,density=1,pathLength=1){
 const w=Math.max(100,wavelengthNm)*1e-9,n=1.0003,N=2.547e25;
 const beta=(8*Math.PI**3*(n*n-1)**2)/(3*N*w**4);
 return 1-Math.exp(-beta*Math.max(0,density)*Math.max(0,pathLength));
}
export function mieScattering(cosTheta,g=.76){
 g=clamp(g,-.99,.99);
 const gg=g*g;return (1-gg)/(4*Math.PI*Math.pow(1+gg-2*g*clamp(cosTheta,-1,1),1.5));
}
export function multipleScattering(singleScatter,albedo=.9,orders=4){
 let radiance=singleScatter,term=singleScatter;
 for(let i=1;i<Math.min(32,Math.max(1,Math.floor(orders)));i++){term*=clamp(albedo)*.23;radiance+=term}
 return radiance;
}
export function aerialPerspective(color,distance,extinction=.00008,fog=[.55,.7,.8]){
 const transmission=Math.exp(-Math.max(0,distance)*extinction);
 return color.map((v,i)=>lerp(fog[i],v,transmission));
}
export function volumetricFogRay(ray,steps,sample,{length=1000}={}){
 steps=Math.min(256,Math.max(1,Math.floor(steps)));
 let T=1,L=[0,0,0];const ds=Math.max(0,length)/steps;
 for(let i=0;i<steps;i++){const p=add(ray.origin,mul(ray.direction,(i+.5)*ds));
 const {density=0,light=[0,0,0]}=sample(p);const extinction=Math.exp(-Math.max(0,density)*ds);
 for(let c=0;c<3;c++)L[c]+=T*(1-extinction)*light[c];T*=extinction;
 }return {radiance:L,transmittance:T};
}
export function volumetricLightBeam(point,light,angle=.5){
 const v=sub(point,light.position),distance=Math.hypot(v.x,v.y,v.z),axis=norm(light.direction);
 const cone=dot(norm(v),axis);return Math.pow(clamp((cone-Math.cos(angle))/(1-Math.cos(angle))),2)/
 Math.max(1,distance*distance);
}
export function cascadedShadowSplits(near,far,cascades=4,lambda=.7){
 if(!(near>0&&far>near))throw RangeError("Invalid camera clipping planes");
 cascades=Math.min(16,Math.max(1,Math.floor(cascades)));
 const result=[];for(let i=1;i<=cascades;i++){const u=i/cascades;
 result.push(lerp(near+(far-near)*u,near*(far/near)**u,lambda))}
 return result;
}
export function contactShadows(distanceToSurface,normalDotLight,range=.7){
 return clamp(1-distanceToSurface/range)*clamp(normalDotLight);
}
export function screenSpaceAmbientOcclusion(depth,neighbors,{radius=.3,bias=.005}={}){
 let covered=0;for(const n of neighbors)covered+=
 clamp((n-depth-bias)/Math.max(radius,1e-6));
 return 1-covered/Math.max(1,neighbors.length);
}
export function screenSpaceReflectionRay(origin,reflection,depthAt,{steps=32,step=.2,thickness=.04}={}){
 for(let i=1;i<=steps;i++){const p=add(origin,mul(reflection,i*step)),d=depthAt(p.x,p.y);
 if(Number.isFinite(d)&&p.z>=d&&p.z-d<=thickness)return {hit:true,position:p,steps:i};}
 return {hit:false};
}
export function imageBasedLighting(normal,roughness,probe){
 const n=norm(normal),level=clamp(roughness)*((probe.mips?.length||1)-1);
 const lower=Math.floor(level),upper=Math.ceil(level),weight=level-lower;
 const A=probe.mips?.[lower]?.(n)??probe.sample(n);
 const B=probe.mips?.[upper]?.(n)??A;
 return A.map((v,i)=>lerp(v,B[i],weight));
}
export function automaticExposure(luminance,previous,dt,{middleGray=.18,speed=1.8}={}){
 const goal=middleGray/Math.max(1e-5,luminance);
 return lerp(previous,clamp(goal,.1,8),1-Math.exp(-dt*speed));
}
export function acesTonemap(rgb,exposure=1){
 return rgb.map(v=>{v=Math.max(0,v*exposure);
 return clamp((v*(2.51*v+.03))/(v*(2.43*v+.59)+.14))});
}
export function selectiveBloom(rgb,threshold=1,intensity=.45){
 const brightness=rgb.reduce((a,b)=>a+b,0)/3;
 return rgb.map(v=>v+Math.max(0,brightness-threshold)*intensity);
}
export function cityNightLights(x,z,floors,time,seed=1){
 const night=clamp(Math.abs(time-12)/6-1),lights=[];
 for(let floor=0;floor<Math.min(1024,Math.max(0,Math.floor(floors)));floor++)lights.push(hash(x|0,z|0,floor,seed)<night*.68);
 return lights;
}
export function aviationLightPhase(seconds,pattern=[.07,.09,.2,1.64]){
 const cycle=pattern.reduce((a,b)=>a+Math.max(0,b),0);
 if(cycle<=0)return false;
 let t=((seconds%cycle)+cycle)%cycle;for(let i=0;i<pattern.length;i++){
 t-=pattern[i];if(t<0)return i%2===0;}return false;
}
export function airportLighting(sunElevation,visibilityMeters,runwayDistance){
 const twilight=clamp((-sunElevation-3)/10),lowVisibility=clamp((5000-visibilityMeters)/4500);
 return {enabled:twilight>.02||lowVisibility>.5,
 intensity:clamp(twilight+lowVisibility*.6),
 approach:runwayDistance<12000,edge:runwayDistance<5000};
}
export const algorithms=[solarEphemeris,lunarEphemeris,rayleighScattering,mieScattering,
 multipleScattering,aerialPerspective,volumetricFogRay,volumetricLightBeam,
 cascadedShadowSplits,contactShadows,screenSpaceAmbientOcclusion,
 screenSpaceReflectionRay,imageBasedLighting,automaticExposure,acesTonemap,
 selectiveBloom,cityNightLights,aviationLightPhase,airportLighting];
