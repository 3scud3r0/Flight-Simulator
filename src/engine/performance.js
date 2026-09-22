/** Algorithms 167–180: measurable frame-time budgeting and failure isolation. */
import {clamp,lerp} from "./math.js";
export function adaptiveResolution(current,frameMs,{target=16.67,
 min=.55,max=1.5,step=.045}={}){
 target=Math.max(1,target);step=Math.max(0,step);
 const deadband=target*.08;
 if(frameMs>target+deadband)return clamp(current-step,min,max);
 if(frameMs<target-deadband)return clamp(current+step*.35,min,max);
 return clamp(current,min,max);
}
export function dynamicQualityBudget(metrics,quality){
 const q={...quality};const over=Math.max(0,metrics.frameMs-16.67);
 q.cloudSteps=q.cloudSteps??16;q.shadowDistance=q.shadowDistance??1000;
 q.vegetationDistance=q.vegetationDistance??800;
 if(over>2){q.cloudSteps=Math.max(4,Math.floor(q.cloudSteps*.86));
 q.shadowDistance=Math.max(200,Math.floor(q.shadowDistance*.9));
 q.vegetationDistance=Math.max(150,Math.floor(q.vegetationDistance*.89))}
 else if(metrics.frameMs<13){q.cloudSteps=Math.min(64,q.cloudSteps+1);
 q.shadowDistance=Math.min(6000,q.shadowDistance+30)}
 return q;
}
export function gpuTimeProfiling(samples){
 const valid=samples.filter(Number.isFinite);
 const sorted=[...valid].sort((a,b)=>a-b),sum=valid.reduce((a,b)=>a+b,0);
 return {mean:sum/Math.max(1,valid.length),
 p95:sorted[Math.max(0,Math.ceil(.95*sorted.length)-1)]||0,
 worst:sorted.at(-1)||0};
}
export function objectPool(factory,reset,capacity=256){
 const available=[],leased=new Set();capacity=Math.max(0,Math.floor(capacity));return {
 acquire(){const obj=available.pop()??factory();leased.add(obj);return obj},
 release(obj){if(!leased.delete(obj))return false;reset(obj);
 if(available.length<capacity)available.push(obj);return true},
 stats(){return {free:available.length,used:leased.size}}
 };
}
export function allocationFreeStep(state,accel,dt,out=state){
 out.vx=state.vx+accel.x*dt;
 out.vy=state.vy+accel.y*dt;
 out.vz=state.vz+accel.z*dt;
 out.x=state.x+out.vx*dt;out.y=state.y+out.vy*dt;
 out.z=state.z+out.vz*dt;return out;
}
export function priorityScheduling(tasks,budget){
 const queues={physics:[],input:[],graphics:[],background:[]};
 for(const task of tasks)(queues[task.kind]??queues.background).push(task);
 const selected=[],deferred=[];let cost=0;
 for(const group of ["physics","input","graphics","background"]){
 for(const task of queues[group]){if(cost+task.cost<=budget||
 ["physics","input"].includes(group)){selected.push(task);cost+=task.cost}
 else deferred.push(task)}}return {selected,deferred,cost};
}
export function gracefulDegradation(features,failures){
 const disabled=new Set(failures);
 const output={...features};for(const feature of disabled)output[feature]=false;
 if(disabled.has("webgl")){output.webgpu=false;output.volumetrics=false;
 output.oceanFFT=false}
 if(disabled.has("terrainNetwork"))output.proceduralTerrain=true;
 return output;
}
export function devicePresets({mobile=false,deviceMemory=4,
 gpuTier=1}={}){
 const low=mobile||deviceMemory<=2||gpuTier===0;
 return {resolution:low?.8:gpuTier>=3?1.5:1,
 terrainLOD:low?2:gpuTier>=3?5:3,
 cloudSteps:low?6:gpuTier>=3?48:18,
 shadows:!low,textureSize:low?256:gpuTier>=3?2048:1024};
}
export function frameWorkBudget(jobs,maxMs=4){
 maxMs=Math.max(0,maxMs);
 const selected=[],pending=[];let used=0;
 for(const job of jobs){if(used+job.estimateMs<=maxMs){
 selected.push(job);used+=job.estimateMs}
 else pending.push(job)}
 return {selected,pending,estimatedMs:used};
}
export function physicsInvariantTests(state,limits={}){
 const failures=[];for(const name of ["x","y","z","vx","vy","vz","speed"])
 if(name in state&&!Number.isFinite(state[name]))failures.push(name+" non-finite");
 if(state.mass!==undefined&&!(state.mass>0))failures.push("mass");
 if(state.q){const n=Math.hypot(state.q.w,state.q.x,state.q.y,state.q.z);
 if(Math.abs(n-1)>.001)failures.push("quaternion norm")}
 if(state.speed>(limits.maxSpeed??Infinity))failures.push("overspeed");
 return {ok:!failures.length,failures};
}
export function visualRegression(actual,reference,{maxMean=.02}={}){
 if(actual.length!==reference.length)throw RangeError("Mismatched image sizes");
 let mean=0,max=0;for(let i=0;i<actual.length;i++){
 const d=Math.abs(actual[i]-reference[i])/255;mean+=d;max=Math.max(max,d)}
 mean/=Math.max(1,actual.length);return {pass:mean<=maxMean,mean,max};
}
export function memoryLeakWatch(samples,{window=60,thresholdMB=24}={}){
 window=Math.max(1,Math.floor(window));
 const early=samples.slice(0,window),late=samples.slice(-window);
 const avg=a=>a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
 const growth=avg(late)-avg(early);
 return {suspectedLeak:samples.length>=window*2&&growth>thresholdMB,
 growthMB:growth};
}
export function localTelemetry(frames){
 const samples=frames.map(f=>Math.max(0,Number.isFinite(f.ms)?f.ms:0)),
 time=samples.reduce((a,b)=>a+b,0);
 return {fps:time?frames.length*1000/time:0,
 averageMs:time/Math.max(1,frames.length),
 slowFrames:samples.filter(x=>x>33.4).length,
 errors:frames.reduce((s,f)=>s+(f.errors||0),0)};
}
export function errorRecovery(operation,fallback,{attempts=2}={}){
 return async()=>{let error;
 for(let i=0;i<Math.min(12,Math.max(1,Math.floor(attempts)));i++)try{return await operation(i)}
 catch(e){error=e}
 return fallback(error)};
}
export const algorithms=[adaptiveResolution,dynamicQualityBudget,
 gpuTimeProfiling,objectPool,allocationFreeStep,priorityScheduling,
 gracefulDegradation,devicePresets,frameWorkBudget,physicsInvariantTests,
 visualRegression,memoryLeakWatch,localTelemetry,errorRecovery];
