/** Algorithms 131–142: procedural airframe geometry and animation poses. */
import {clamp,lerp,smooth,vec,add,sub,mul,hash} from "./math.js";
export function parametricFuselage(sections,radial=24){
 const vertices=[],indices=[];
 for(let i=0;i<sections.length;i++){const s=sections[i];
 for(let j=0;j<radial;j++){const angle=j*2*Math.PI/radial;
 vertices.push(vec(s.cx+(s.rx||0)*Math.cos(angle),
 s.cy+(s.ry||0)*Math.sin(angle),s.z))}}
 for(let i=0;i<sections.length-1;i++)for(let j=0;j<radial;j++){
 const a=i*radial+j,b=i*radial+(j+1)%radial,c=a+radial,d=b+radial;
 indices.push([a,c,b],[b,c,d])}return {vertices,triangles:indices};
}
export function airfoilWingMesh({span=11,chord=1.6,tipChord=.7,
 sweep=.5,dihedral=.05,camber=.035,thickness=.12,stations=12}={}){
 const vertices=[],triangles=[];
 for(let side of [-1,1]){const offset=vertices.length;
 for(let i=0;i<=stations;i++){const t=i/stations,localChord=lerp(chord,tipChord,t);
 for(let surface of [1,-1])for(let j=0;j<=12;j++){
 const u=j/12,camberZ=4*camber*u*(1-u);
 const yy=dihedral*t*span/2+camberZ+surface*thickness*Math.sqrt(
 Math.max(0,u))*Math.max(0,1-u)*localChord*.5;
 vertices.push(vec(side*t*span/2,yy,-chord*.25+sweep*t+u*localChord));}}
 const row=26;for(let i=0;i<stations;i++)for(let layer=0;layer<2;layer++)
 for(let j=0;j<12;j++){const a=offset+i*row+layer*13+j,
 b=a+row;triangles.push([a,b,a+1],[a+1,b,b+1])}}
 return {vertices,triangles};
}
export function aircraftLOD(distance,{near=150,far=1800}={}){
 return distance<near?"cockpit":distance<far?"exterior":"impostor";
}
export function movableSurfaces(input,limits={ailerons:.28,elevator:.31,rudder:.36,flaps:.65}){
 const clamp1=v=>clamp(v,-1,1);return {
 leftAileron:clamp1(input.aileron)*limits.ailerons,
 rightAileron:-clamp1(input.aileron)*limits.ailerons,
 elevator:clamp1(input.elevator)*limits.elevator,
 rudder:clamp1(input.rudder)*limits.rudder,
 flaps:clamp(input.flaps)*limits.flaps};
}
export function landingGearAnimation(previous,extended,dt,speed=.65){
 const progress=clamp(previous+(extended?1:-1)*dt*speed);
 return {progress,doorAngle:Math.sin(Math.PI*progress)*1.2,
 strutAngle:progress*Math.PI/2,locked:progress===0||progress===1};
}
export function propellerMotionBlur(rpm,fps,bladeCount=2){
 const cycles=rpm/60/Math.max(1,fps),opacity=clamp(cycles*bladeCount/3);
 return {discOpacity:opacity,bladeOpacity:1-opacity,
 rotationStep:cycles*2*Math.PI};
}
export function layeredCabinMaterial(paint,wear=.15,dust=.08){
 return {base:paint.map(v=>v*(1-wear*.35)),
 roughness:clamp(.2+wear*.6+dust*.3,.05,1),
 clearcoat:clamp(1-wear),dust:clamp(dust)};
}
export function flightInstruments(state){
 return {iasKnots:(state.ias??state.speed)*1.943844,
 altitudeFeet:state.y*3.28084,verticalSpeedFpm:state.verticalSpeed*196.8504,
 headingDeg:(((state.heading||0)*180/Math.PI)%360+360)%360,
 bankDeg:(state.roll||0)*180/Math.PI,pitchDeg:(state.pitch||0)*180/Math.PI,
 throttlePercent:clamp(state.throttle)*100};
}
export function proceduralCockpitAnimation(input,state){
 return {yokePitch:clamp(input.elevator,-1,1)*.35,
 yokeRoll:clamp(input.aileron,-1,1)*.52,
 rudderPedal:clamp(input.rudder,-1,1)*.17,
 throttle:clamp(state.throttle),
 gearLever:state.gear?1:0,flapLever:clamp(state.flaps)};
}
export function inertialCamera(previous,aircraft,acceleration,dt,{
 spring=5,shake=.005}={}){
 const blend=1-Math.exp(-Math.max(0,dt)*spring);
 return {position:add(previous.position,mul(sub(aircraft.position,
 previous.position),blend)),
 pitch:lerp(previous.pitch,aircraft.pitch-acceleration.y*shake,blend),
 roll:lerp(previous.roll,aircraft.roll-acceleration.x*shake,blend)};
}
export function structuralVibration(time,airspeed,roughness,seed=1){
 const amplitude=clamp(airspeed/180)*clamp(roughness)*.025;
 return vec(Math.sin(time*37+seed)*amplitude,
 Math.sin(time*53+seed)*amplitude*.7,
 Math.sin(time*29+seed)*amplitude*.5);
}
export function componentDamage(components,collision){
 const output=components.map(c=>({...c}));
 for(const c of output){const dx=c.position.x-collision.position.x,
 dy=c.position.y-collision.position.y,dz=c.position.z-collision.position.z;
 const distance=Math.hypot(dx,dy,dz),exposure=Math.exp(
 -(distance/Math.max(1,collision.radius))**2);
 c.health=clamp(c.health-(collision.energy/Math.max(1,c.toughness))*exposure)}
 return output;
}
export const algorithms=[parametricFuselage,airfoilWingMesh,aircraftLOD,
 movableSurfaces,landingGearAnimation,propellerMotionBlur,
 layeredCabinMaterial,flightInstruments,proceduralCockpitAnimation,
 inertialCamera,structuralVibration,componentDamage];
