/** Algorithms 103–130: parameterized, scene-independent flight-dynamics kernels.
 * Educational flight mechanics. No manufacturer flight-test validation. */
import {clamp,lerp,vec,add,sub,mul,dot,cross,norm,length} from "./math.js";
import {qNormalize,qMultiply,qRotate,qInverseRotate} from "../six-dof.js";
import {isa} from "../atmosphere.js";
export function rigidBody6DOF(state,forceBody,momentBody,mass,inertia,dt){
 if(mass<=0||dt<=0)throw RangeError("Positive mass and dt required");
 const w=state.omega,iv=vec(w.x*inertia.x,w.y*inertia.y,w.z*inertia.z);
 const gyro=cross(w,iv),torque=sub(momentBody,gyro);
 const v=add(state.velocity,mul(add(mul(qRotate(state.q,forceBody),1/mass),vec(0,-9.80665,0)),dt));
 const omega=add(w,mul(vec(torque.x/inertia.x,torque.y/inertia.y,torque.z/inertia.z),dt));
 const dq=qMultiply(state.q,{w:0,...omega});
 const q=qNormalize({w:state.q.w+dq.w*dt/2,x:state.q.x+dq.x*dt/2,
 y:state.q.y+dq.y*dt/2,z:state.q.z+dq.z*dt/2});
 return {...state,velocity:v,omega,q,position:add(state.position,mul(v,dt))};
}
export function quaternionIntegrate(q,omega,dt){
 const w=length(omega),angle=w*dt;if(angle<1e-10)return qNormalize(q);
 const h=angle/2,s=Math.sin(h)/w,delta={w:Math.cos(h),x:omega.x*s,y:omega.y*s,z:omega.z*s};
 return qNormalize(qMultiply(q,delta));
}
export function rungeKutta4(state,dt,derivative){
 const apply=(x,d,h)=>x.map((v,i)=>v+d[i]*h);
 const a=derivative(state),b=derivative(apply(state,a,dt/2)),
 c=derivative(apply(state,b,dt/2)),d=derivative(apply(state,c,dt));
 return state.map((v,i)=>v+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);
}
export function semiImplicitIntegrator(pos,velocity,accel,dt){
 const v=add(velocity,mul(accel,dt));
 return {position:add(pos,mul(v,dt)),velocity:v};
}
export function fixedStepInterpolation(previous,current,accumulator,step){
 const t=clamp(accumulator/Math.max(step,1e-9));return {
 position:add(previous.position,mul(sub(current.position,previous.position),t)),
 alpha:t};
}
export function aeroCoefficientModel(alpha,beta,elevator=0,flaps=0,config={}){
 const cl0=config.cl0??.24,slope=config.clAlpha??5.1,limit=config.maxCL??1.6;
 const cl=clamp(cl0+slope*alpha+flaps*.39+elevator*.16,-.85,limit+flaps*.25);
 const cd=(config.cd0??.024)+(config.induced??.057)*cl*cl+Math.abs(beta)*.02;
 return {cl,cd,cy:-.74*beta,cm:(config.cm0??.02)-.8*alpha-.56*elevator};
}
export function lookupAeroTable(samples,x){
 if(!samples.length)throw RangeError("Empty coefficient table");
 if(x<=samples[0].x)return samples[0].value;
 for(let i=1;i<samples.length;i++)if(x<=samples[i].x){
 const a=samples[i-1],b=samples[i];return lerp(a.value,b.value,(x-a.x)/(b.x-a.x));}
 return samples.at(-1).value;
}
export function angleOfAttackSideslip(bodyAirVelocity){
 const {x,y,z}=bodyAirVelocity,forward=Math.max(.001,-z);
 return {alpha:Math.atan2(-y,forward),beta:Math.atan2(x,Math.hypot(y,z)),
 trueAirspeed:length(bodyAirVelocity)};
}
export function nonlinearLift(alpha,{cl0=.24,slope=5.2,critical=.27,maxCL=1.6}={}){
 const raw=clamp(cl0+slope*alpha,-maxCL,maxCL);
 const beyond=Math.max(0,Math.abs(alpha)-critical);
 return raw*Math.exp(-4.8*beyond);
}
export function stallHysteresis(previousStalled,alpha,enter=.28,recover=.21){
 return previousStalled?Math.abs(alpha)>recover:Math.abs(alpha)>enter;
}
export function inducedDrag(cl,aspectRatio=7.5,efficiency=.82){
 return cl*cl/(Math.PI*Math.max(.1,aspectRatio)*Math.max(.1,efficiency));
}
export function parasiteDrag(cd0,gear,flaps,brakes=0){
 return Math.max(0,cd0)+ (gear?.016:0)+clamp(flaps)*.085+clamp(brakes)*.08;
}
export function groundEffect(height,wingspan,cl){
 const h=Math.max(.01,height)/Math.max(.01,wingspan);
 return {lift:cl*(1+.12/(1+16*h*h)),
 inducedDragScale:1- .45/(1+16*h*h)};
}
export function stabilityDerivatives(alpha,beta,rate,{pitch=-.82,roll=-.5,yaw=-.38}={}){
 return {pitch:pitch*alpha-rate.x*.15,roll:roll*beta-rate.z*.25,
 yaw:yaw*beta-rate.y*.28};
}
export function aerodynamicDamping(omega,dynamicPressure,refLength,coefficients){
 return vec(omega.x*dynamicPressure*refLength*coefficients.x,
 omega.y*dynamicPressure*refLength*coefficients.y,
 omega.z*dynamicPressure*refLength*coefficients.z);
}
export function controlAuthority(command,dynamicPressure,referencePressure){
 return clamp(command,-1,1)*clamp(dynamicPressure/Math.max(1,referencePressure),.025,1.8);
}
export function engineSpool(previous,target,dt,{up=3.1,down=1.7}={}){
 const time=target>previous?up:down;
 return lerp(previous,clamp(target),1-Math.exp(-Math.max(0,dt)/time));
}
export function propellerPerformance(rpm,airspeed,{diameter=1.9,power=130000,rho=1.225}={}){
 const n=Math.max(.1,rpm/60),J=Math.max(0,airspeed)/(n*diameter);
 const efficiency=clamp(.73*Math.exp(-1*((J-.75)/.8)**2),0,.86);
 const thrust=power*Math.max(.05,efficiency)/Math.max(airspeed,12);
 const tipMach=Math.PI*diameter*n/340;
 return {thrust,efficiency,advanceRatio:J,tipMach};
}
export function turbineThrust(throttle,altitude,mach,{seaLevel=110000,bypass=5}={}){
 const rho=isa(altitude).densityRatio,ram=1+.14*clamp(mach,0,2);
 return seaLevel*clamp(throttle)*Math.pow(rho,.75)*ram*(1-.008*bypass);
}
export function fuelTransfer(tanks,massKg,from,to){
 const t=tanks.map(x=>({...x})),transfer=Math.max(0,Math.min(massKg,t[from].fuel,
 t[to].capacity-t[to].fuel));t[from].fuel-=transfer;t[to].fuel+=transfer;
 const total=t.reduce((s,x)=>s+x.fuel,0);
 const cg=total>0?t.reduce((s,x)=>s+x.fuel*x.arm,0)/total:0;
 return {tanks:t,transferred:transfer,centerOfGravity:cg};
}
export function inertiaTensor(parts){
 let xx=0,yy=0,zz=0,xy=0,xz=0,yz=0;
 for(const {mass:m,x,y,z} of parts){xx+=m*(y*y+z*z);yy+=m*(x*x+z*z);zz+=m*(x*x+y*y);
 xy-=m*x*y;xz-=m*x*z;yz-=m*y*z}
 return [[xx,xy,xz],[xy,yy,yz],[xz,yz,zz]];
}
export function landingGearSpring(compression,velocity,{stiffness=85000,damping=9700,stroke=.5}={}){
 const travel=clamp(compression,0,stroke);
 return Math.max(0,stiffness*travel+damping*velocity);
}
export function tireFriction(normalForce,slip,{mu=0.75,stiffness=9}={}){
 return -Math.tanh(slip*stiffness)*Math.max(0,normalForce)*mu;
}
export function differentialBraking(left,right,speed,track=3,coefficient=900){
 return clamp(right-left,-1,1)*Math.max(0,speed)*coefficient*track*.1;
}
export function continuousCollision(origin,velocity,dt,heightAt,clearance=0){
 const end=add(origin,mul(velocity,dt));
 const f=t=>origin.y+velocity.y*dt*t-heightAt(
 origin.x+velocity.x*dt*t,origin.z+velocity.z*dt*t)-clearance;
 if(f(0)<=0)return {hit:true,t:0,position:origin};
 if(f(1)>0)return {hit:false,position:end};
 let lo=0,hi=1;for(let i=0;i<25;i++){const m=(lo+hi)/2;
 if(f(m)>0)lo=m;else hi=m}
 return {hit:true,t:hi,position:add(origin,mul(velocity,dt*hi))};
}
export function impactEnergy(mass,velocity,normal){
 const perpendicular=Math.abs(dot(velocity,norm(normal)));
 return {energy:.5*mass*perpendicular**2,verticalSpeed:perpendicular};
}
export function pidAutopilot(error,integral,previousError,dt,{kp=1,ki=0,kd=.1,limit=1}={}){
 const next=clamp(integral+error*dt,-limit/Math.max(ki,1e-4),
 limit/Math.max(ki,1e-4)),derivative=(error-previousError)/Math.max(dt,.0001);
 return {control:clamp(kp*error+ki*next+kd*derivative,-limit,limit),
 integral:next};
}
export function lqrController(A,B,Q,R,{iterations=80,bound=1}={}){
 // Discrete Riccati iteration for a 2-state / 1-control model.
 const tr=a=>[[a[0][0],a[1][0]],[a[0][1],a[1][1]]];
 const mm=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((s,v,k)=>s+v*b[k][j],0)));
 const sum=(a,b,sign=1)=>a.map((row,i)=>row.map((v,j)=>v+sign*b[i][j]));
 const BT=tr(B),AT=tr(A);let P=Q.map(row=>[...row]),K=[[0,0]];
 for(let i=0;i<iterations;i++){
 const BP=mm(BT,P),denom=R+mm(BP,B)[0][0];
 K=mm(BP,A).map(row=>row.map(v=>v/Math.max(1e-6,denom)));
 const AP=mm(AT,P);P=sum(Q,sum(mm(AP,A),mm(mm(AP,B),K),-1));
 }
 return {gain:K[0],control(state){return clamp(
 -1*(K[0][0]*state[0]+K[0][1]*state[1]),-bound,bound)}};
}
export const algorithms=[rigidBody6DOF,quaternionIntegrate,rungeKutta4,
 semiImplicitIntegrator,fixedStepInterpolation,aeroCoefficientModel,
 lookupAeroTable,angleOfAttackSideslip,nonlinearLift,stallHysteresis,
 inducedDrag,parasiteDrag,groundEffect,stabilityDerivatives,
 aerodynamicDamping,controlAuthority,engineSpool,propellerPerformance,
 turbineThrust,fuelTransfer,inertiaTensor,landingGearSpring,tireFriction,
 differentialBraking,continuousCollision,impactEnergy,pidAutopilot,lqrController];
