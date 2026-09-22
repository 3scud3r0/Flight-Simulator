/** Algorithms 075–092: cloud, precipitation, atmosphere and moving weather fields. */
import {clamp,lerp,smooth,noise2,noise3,hash,vec,add,mul,norm,dot} from "./math.js";
import {isa,windAt} from "../atmosphere.js";
export function cloudRaymarch(ray,steps,field,{distance=8000,extinction=.035}={}){
 let transmittance=1,radiance=0;const ds=distance/Math.max(1,steps);
 for(let i=0;i<steps;i++){const pos=add(ray.origin,mul(ray.direction,(i+.5)*ds));
 const density=clamp(field(pos)),atten=Math.exp(-density*extinction*ds);
 radiance+=transmittance*(1-atten);transmittance*=atten;
 if(transmittance<.005)break;
 }return {radiance,transmittance};
}
export function worleyPerlinCloud(x,y,z,{seed=1,scale=.008}={}){
 const X=x*scale,Y=y*scale,Z=z*scale,i=Math.floor(X),j=Math.floor(Y),k=Math.floor(Z);
 let nearest=10;for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
 const p=i+dx,q=j+dy,r=k+dz;
 const px=p+hash(p,q,r,seed),py=q+hash(p,q,r,seed+1),pz=r+hash(p,q,r,seed+2);
 nearest=Math.min(nearest,Math.hypot(X-px,Y-py,Z-pz))}
 return clamp((1-nearest)*.72+noise3(X*2,Y*2,Z*2,seed+7)*.28);
}
export function cloudWeatherMap(x,z,time,{seed=1}={}){
 const humidity=clamp(.55+.31*noise2(x*.00012+time*.002,z*.00012,seed));
 const coverage=clamp(humidity+.25*noise2(x*.00037,z*.00037+time*.006,seed+2));
 return {humidity,coverage,storm:clamp((coverage-.67)*3.3)};
}
export function temporalReprojection(current,previous,motion,validity=.9){
 if(!previous||!current)return current;const t=clamp(validity)*
 clamp(1-Math.hypot(motion.x,motion.y)*.045);
 return current.map((x,i)=>lerp(x,previous[i]??x,t));
}
export function cloudShadowMap(densityAlongRay,steps=16){
 let opticalDepth=0;for(let i=0;i<steps;i++)opticalDepth+=
 Math.max(0,densityAlongRay((i+.5)/steps))/steps;
 return Math.exp(-opticalDepth*3.5);
}
export function cumulonimbusProfile(height,{base=1200,top=11000,energy=.8}={}){
 const h=clamp((height-base)/(top-base));
 const anvil=smooth((h-.68)/.29),body=Math.sin(Math.PI*h)**.55;
 return {density:clamp(body*energy),radius:lerp(250,1000,h)*(1+anvil*1.9),anvil};
}
export function evolveCloudCover(coverage,target,dt,formationSeconds=600){
 const a=1-Math.exp(-Math.max(0,dt)/formationSeconds);
 return lerp(clamp(coverage),clamp(target),a);
}
export function thermalLapseRate(height,surfaceC=25,lapseKperKm=6.5){
 return surfaceC-Math.min(11000,Math.max(0,height))*lapseKperKm/1000;
}
export function internationalStandardAtmosphere(height,offset=0){return isa(height,offset)}
export function threeDimensionalWind(x,y,z,t,preset="limpo"){
 const background=windAt(y,t,preset);
 return {x:background.x+noise3(x*.0002,y*.0003+t*.03,z*.0002,1)*1.3,
 y:background.y+noise3(x*.0003,y*.0004,z*.0003+t*.02,4)*.65,
 z:background.z+noise3(x*.0002+t*.02,y*.0003,z*.0002,7)*1.3};
}
export function windShear(lower,upper,verticalSeparation){
 return {x:(upper.x-lower.x)/Math.max(1,verticalSeparation),
 y:(upper.y-lower.y)/Math.max(1,verticalSeparation),
 z:(upper.z-lower.z)/Math.max(1,verticalSeparation)};
}
export function correlatedGust(previous,dt,random,{sigma=2,tau=5}={}){
 const a=Math.exp(-Math.max(0,dt)/Math.max(.01,tau));
 return a*previous+Math.sqrt(1-a*a)*sigma*(random()*2-1)*Math.sqrt(3);
}
export function orographicTurbulence(wind,terrainGradient,heightAboveGround){
 const uphill=wind.x*terrainGradient.x+wind.z*terrainGradient.z;
 const strength=Math.exp(-Math.max(0,heightAboveGround)/550);
 return {updraft:Math.max(0,uphill)*strength*.12,
 downdraft:Math.max(0,-uphill)*strength*.20,
 turbulence:Math.abs(uphill)*strength*.035};
}
export function thermalUpdraft(distanceToCore,height,{radius=220,base=0,top=2200,max=3.5}={}){
 const radial=Math.exp(-1*(distanceToCore/Math.max(1,radius))**2);
 const vertical=Math.sin(Math.PI*clamp((height-base)/Math.max(1,top-base)));
 return max*radial*vertical;
}
export function precipitationIntensity(cloudWater,updraft,tempC){
 const amount=clamp((cloudWater-.35)*2+updraft*.08);
 return {rain:tempC>0?amount:0,snow:tempC<=0?amount:0};
}
export function airframeIcing(tempC,liquidWater,airspeed,dt,current=0){
 const window=clamp((0-tempC)/8)*clamp((tempC+24)/13);
 return clamp(current+window*clamp(liquidWater)*Math.sqrt(Math.max(0,airspeed))/250*dt);
}
export function meteorologicalVisibility(humidity,rain,fog,dust){
 const ext=.000007+clamp(humidity)*.000013+
 clamp(rain)*.0003+clamp(fog)*.001+clamp(dust)*.0007;
 return clamp(3/ext,80,100000);
}
export function movingWeatherFront(x,z,t,{x0=0,z0=0,vx=7,vz=2,width=4000}={}){
 const offset=(x-x0-vx*t)*vx+(z-z0-vz*t)*vz;
 const d=offset/Math.max(1,Math.hypot(vx,vz));
 const severity=smooth(.5-d/Math.max(1,width));
 return {severity,clouds:lerp(.2,.92,severity),rain:clamp((severity-.4)*2)};
}
export const algorithms=[cloudRaymarch,worleyPerlinCloud,cloudWeatherMap,
 temporalReprojection,cloudShadowMap,cumulonimbusProfile,evolveCloudCover,
 thermalLapseRate,internationalStandardAtmosphere,threeDimensionalWind,
 windShear,correlatedGust,orographicTurbulence,thermalUpdraft,
 precipitationIntensity,airframeIcing,meteorologicalVisibility,movingWeatherFront];
