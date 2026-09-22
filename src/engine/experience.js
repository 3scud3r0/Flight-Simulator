/** Algorithms 155–166: deterministic audio and game-feel models, no audio-device side effects. */
import {clamp,lerp,vec,add,sub,mul,norm,hash} from "./math.js";
export function proceduralEngineAudio(throttle,rpm,type="piston"){
 const base=type==="jet"?45:type==="turboprop"?78:35;
 return {fundamentalHz:base+rpm/60*(type==="jet"?1:2),
 harmonics:[1,2,3,4,6].map(k=>({multiplier:k,gain:clamp(throttle)/(k*k)})),
 noise:clamp(throttle)*(type==="jet"?.8:.18)};
}
export function layeredAudioSpectrum(layers){
 const bins=new Float32Array(512);
 for(const layer of layers){const center=clamp(
 Math.round(layer.hz/22050*512),0,511);
 for(let k=Math.max(0,center-3);k<=Math.min(511,center+3);k++)
 bins[k]+=(layer.gain||0)*Math.exp(-((k-center)/1.3)**2)}
 return bins;
}
export function cockpitOcclusion(exterior,inside,factor=.72){
 return {gain:exterior.gain*(1-clamp(factor))+
 inside.gain*clamp(factor),cutoffHz:lerp(14000,950,clamp(factor))};
}
export function spatialAudio(source,listener,{maxDistance=8000}={}){
 const d=sub(source,listener),dist=Math.hypot(d.x,d.y,d.z),
 pan=clamp(d.x/Math.max(1,dist));
 return {gain:1/(1+(dist/Math.max(1,maxDistance))**2),
 pan,distance:dist};
}
export function aerodynamicAudio(airspeed,turbulence,angleOfAttack){
 return {wind:clamp(airspeed/150)*.7,
 buffeting:clamp(turbulence)*clamp(Math.abs(angleOfAttack)/.38),
 frequencyHz:100+airspeed*1.2};
}
export function adaptiveHUD(state,mode="free"){
 return {showScore:mode==="challenge",showApproach:state.y<500,
 showStall:state.stall,showGear:state.y<1500,
 velocity:state.ias??state.speed};
}
export function deterministicReplay(initial,inputs,integrate){
 const history=[structuredClone(initial)];let state=structuredClone(initial);
 for(const input of inputs){state=integrate(state,input);
 history.push(structuredClone(state))}
 return history;
}
export function cinematicCamera(plane,landmark,dt=1/60){
 const separation=Math.hypot(plane.x-landmark.x,plane.z-landmark.z);
 return {position:vec(plane.x-60,plane.y+18+separation*.003,plane.z+90),
 target:vec(plane.x,plane.y+3,plane.z),fov:clamp(65-separation*.001,38,70)};
}
export function proceduralPrecisionCourse(route,sampleHeight,{clearance=200,
 spacing=350,maxBank=.35}={}){
 const gates=[];for(let i=0;i<route.length;i++){
 const p=route[i];if(i&&Math.hypot(p.x-route[i-1].x,p.z-route[i-1].z)<spacing)continue;
 gates.push({x:p.x,y:Math.max(p.y||0,sampleHeight(p.x,p.z)+clearance),
 z:p.z,radius:clamp(65-Math.abs(p.turn||0)*maxBank*40,28,65)})}return gates;
}
export function trajectoryScore(events,{base=100,timeWeight=.6,
 precisionWeight=2}={}){
 return events.reduce((score,e)=>score+(e.hit?base*
 clamp(e.precision,0,1)**precisionWeight+
 clamp(e.speed/90)*base*timeWeight:0),0);
}
export function combinatorialMissions(airports,landmarks,types,seed=1){
 const result=[];for(let i=0;i<Math.min(1000,airports.length*
 Math.max(1,landmarks.length)*types.length);i++){
 const from=airports[i%airports.length],
 target=landmarks[(i*7+seed)%landmarks.length],
 type=types[(i*11+seed)%types.length];
 result.push({id:i,type,from:from.id,to:target.id,difficulty:clamp(
 Math.hypot(from.x-target.x,from.z-target.z)/150000)});}
 return result;
}
export function difficultyScaling(score,misses,baseline=1){
 return clamp(baseline+score/50000-misses*.06,.35,2.2);
}
export const algorithms=[proceduralEngineAudio,layeredAudioSpectrum,
 cockpitOcclusion,spatialAudio,aerodynamicAudio,adaptiveHUD,
 deterministicReplay,cinematicCamera,proceduralPrecisionCourse,
 trajectoryScore,combinatorialMissions,difficultyScaling];
