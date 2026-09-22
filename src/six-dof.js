/**
 * Six-degree-of-freedom educational rigid-body aircraft model.
 * 3 translational + 3 rotational DOF; quaternions avoid Euler gimbal lock.
 * Not validated against flight-test datasets or suitable for real training.
 *
 * World: X east, Y up, Z south. Body: X right, Y up, -Z forward.
 * q = body→world unit quaternion {w,x,y,z}.
 */
import { AIRCRAFT, clamp, rad, normalizeHeading } from "./physics.js";
import { isa, G } from "./atmosphere.js";

export function qMultiply(a, b) {
  return {
    w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
    x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
    y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
    z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w
  };
}
export function qNormalize(q) {
  const mag = Math.hypot(q.w, q.x, q.y, q.z) || 1;
  return { w:q.w/mag, x:q.x/mag, y:q.y/mag, z:q.z/mag };
}
export function qRotate(q, v) {
  const u = { x:q.x, y:q.y, z:q.z };
  const dot = u.x*v.x + u.y*v.y + u.z*v.z;
  const cross = {
    x:u.y*v.z-u.z*v.y, y:u.z*v.x-u.x*v.z, z:u.x*v.y-u.y*v.x
  };
  return {
    x: 2*dot*u.x + (q.w*q.w-u.x*u.x-u.y*u.y-u.z*u.z)*v.x +
      2*q.w*cross.x,
    y: 2*dot*u.y + (q.w*q.w-u.x*u.x-u.y*u.y-u.z*u.z)*v.y +
      2*q.w*cross.y,
    z: 2*dot*u.z + (q.w*q.w-u.x*u.x-u.y*u.y-u.z*u.z)*v.z +
      2*q.w*cross.z
  };
}
export function qInverseRotate(q, v) {
  return qRotate({ w:q.w, x:-q.x, y:-q.y, z:-q.z }, v);
}
export function qFromEuler(heading, pitch, roll) {
  const half = a=>a/2;
  const yaw = { w:Math.cos(half(-heading)),x:0,
    y:Math.sin(half(-heading)),z:0 };
  const elev = { w:Math.cos(half(pitch)),x:Math.sin(half(pitch)),y:0,z:0 };
  const bank = { w:Math.cos(half(-roll)),x:0,y:0,z:Math.sin(half(-roll)) };
  return qNormalize(qMultiply(qMultiply(yaw,elev),bank));
}
export function createRigidFlight(initial) {
  const state = { ...initial };
  state.q = qFromEuler(initial.heading, initial.pitch, initial.roll);
  const fwd = qRotate(state.q, {x:0,y:0,z:-1});
  state.vx = fwd.x * initial.speed;
  state.vy = initial.verticalSpeed || 0;
  state.vz = fwd.z * initial.speed;
  state.omega = { x:0,y:0,z:0 };
  state.elevatorAngle = 0; state.aileronAngle = 0; state.rudderAngle = 0;
  state.slip = 0;
  state.mach = 0;
  state.ias = initial.speed;
  return state;
}
function integrateAttitude(q, omega, dt) {
  // qDot = 0.5 q ⊗ [0,ωbody]; semi-implicit Euler, renormalized.
  const derivative = qMultiply(q, {w:0,...omega});
  return qNormalize({
    w:q.w + derivative.w * dt/2,
    x:q.x + derivative.x * dt/2,
    y:q.y + derivative.y * dt/2,
    z:q.z + derivative.z * dt/2
  });
}
export function stepRigidFlight(s, input={}, dt=1/60, height=0) {
  if (!Number.isFinite(dt) || dt <= 0) return s;
  dt = clamp(dt, 0, 1/30);
  const a = AIRCRAFT[s.aircraftId] || AIRCRAFT.cessna;
  if (!s.q || !s.omega) throw new TypeError("Call createRigidFlight first");
  const wind = {x:Number(input.windX)||0,y:Number(input.windY)||0,
    z:Number(input.windZ)||0};
  s.throttle = clamp(s.throttle + (Number(input.throttleDelta)||0)*dt,0,1);
  s.trim = clamp(s.trim + (Number(input.trimDelta)||0)*dt,-1,1);
  const surfaceRate = dt*2.8;
  s.elevatorAngle += (clamp((Number(input.elevator)||0)+s.trim*.2,-1,1) -
    s.elevatorAngle)*Math.min(1,surfaceRate);
  s.aileronAngle += (clamp(Number(input.aileron)||0,-1,1) -
    s.aileronAngle)*Math.min(1,surfaceRate);
  s.rudderAngle += (clamp(Number(input.rudder)||0,-1,1) -
    s.rudderAngle)*Math.min(1,surfaceRate);
  const relative = {x:s.vx-wind.x,y:s.vy-wind.y,z:s.vz-wind.z};
  const body = qInverseRotate(s.q, relative);
  const V = Math.max(.1, Math.hypot(body.x,body.y,body.z));
  const u = Math.max(1, -body.z);
  const alpha = Math.atan2(-body.y,u);
  const beta = Math.atan2(body.x,Math.max(1,Math.hypot(body.y,body.z)));
  const atmosphere = isa(s.y, Number(input.temperatureOffsetC)||0);
  const dyn = .5*atmosphere.density*V*V;
  let CL = a.cl0 + a.liftSlope * alpha + s.flaps*.33 +
    s.elevatorAngle*.10;
  const critical = a.stallAoA + s.flaps*.025;
  const separated = Math.abs(alpha) > critical;
  CL = clamp(CL,-.85,a.maxCL + s.flaps*.18);
  if (separated) {
    CL *= clamp(1 - (Math.abs(alpha)-critical)*3.0,.13,1);
  }
  const CD = a.cd0 + a.induced*CL*CL + (s.gear?.017:0) +
    s.flaps*.07 + (separated?.17:0) + .045*beta*beta;
  const lift = dyn*a.wingArea*CL;
  const drag = dyn*a.wingArea*CD;
  const side = -dyn*a.wingArea*.68*beta;
  const thrust = a.thrust * s.throttle * (s.fuel>0?1:0) *
    Math.pow(atmosphere.densityRatio,.70);
  // Body-axis lift vector is perpendicular to relative velocity in Y-Z.
  const liftDirectionY = Math.max(.01,-body.z)/V;
  const liftDirectionZ = body.y/V;
  const localForces = {
    x: -drag*body.x/V + side,
    y: lift*liftDirectionY - drag*body.y/V,
    z: -thrust + lift*liftDirectionZ - drag*body.z/V
  };
  const force = qRotate(s.q,localForces);
  const boost = clamp(Number(input.boostAcceleration)||0,0,15);
  const fwd = qRotate(s.q,{x:0,y:0,z:-1});
  const ground = Math.max(0,height) + (s.gear?a.clearance:a.clearance*.48);
  const isGround = s.y <= ground+.12 && s.vy <= 1.5;
  const mass = a.mass;
  let ax = force.x/mass + (isGround?0:boost*fwd.x);
  let ay = force.y/mass - G + (isGround?0:boost*fwd.y);
  let az = force.z/mass + (isGround?0:boost*fwd.z);
  if (isGround) {
    ay = Math.max(0,ay);
    const brake = input.brake ? 4.0 : .028;
    ax -= s.vx*brake; az -= s.vz*brake;
  }
  s.vx += clamp(ax,-50,50)*dt;
  s.vy += clamp(ay,-50,50)*dt;
  s.vz += clamp(az,-50,50)*dt;
  const previous = {x:s.x,y:s.y,z:s.z};
  s.x += s.vx*dt; s.y += s.vy*dt; s.z += s.vz*dt;
  if (s.y < ground) {
    if (s.vy < -7 || (!s.gear && Math.hypot(s.vx,s.vz)>15)) s.damaged=true;
    s.y=ground; s.vy=0; s.onGround=true;
  } else s.onGround=false;
  // Principal inertia estimates for aircraft scaled to actual wingspan/length.
  const I = {
    x:mass*(a.length*a.length*.052 + a.wingspan*a.wingspan*.015),
    y:mass*(a.wingspan*a.wingspan*.065 + a.length*a.length*.025),
    z:mass*(a.wingspan*a.wingspan*.083)
  };
  const authority=clamp(dyn/(.5*1.225*a.rotationSpeed**2),.04,2.2);
  const w=s.omega;
  const desired = {
    x:(s.elevatorAngle*.62 - s.pitch*.035)*authority - w.x*.94,
    y:(-s.rudderAngle*.36 + beta*.36)*authority - w.y*.95,
    z:(-s.aileronAngle*.9)*authority - w.z*.88
  };
  // Ground steering is driven by rudder and limited by ground speed.
  if (s.onGround) {
    desired.x=-w.x*4;
    desired.z=-w.z*4;
    desired.y=-s.rudderAngle*Math.min(1,Math.hypot(s.vx,s.vz)/20)*.35-w.y*3;
  }
  const Iw={x:I.x*w.x,y:I.y*w.y,z:I.z*w.z};
  const cross = {
    x:w.y*Iw.z-w.z*Iw.y,
    y:w.z*Iw.x-w.x*Iw.z,
    z:w.x*Iw.y-w.y*Iw.x
  };
  w.x=clamp(w.x+(desired.x-cross.x/I.x)*dt,-1.5,1.5);
  w.y=clamp(w.y+(desired.y-cross.y/I.y)*dt,-1.5,1.5);
  w.z=clamp(w.z+(desired.z-cross.z/I.z)*dt,-1.5,1.5);
  s.q=integrateAttitude(s.q,w,dt);
  const newForward=qRotate(s.q,{x:0,y:0,z:-1});
  const right=qRotate(s.q,{x:1,y:0,z:0});
  const up=qRotate(s.q,{x:0,y:1,z:0});
  s.pitch=Math.asin(clamp(newForward.y,-1,1));
  s.heading=normalizeHeading(Math.atan2(newForward.x,-newForward.z));
  s.roll=Math.atan2(-right.y,up.y);
  s.speed=V;
  s.ias=V*Math.sqrt(atmosphere.density/1.225);
  s.verticalSpeed=s.vy;
  s.aoa=alpha; s.slip=beta; s.stall=separated && V>12;
  s.gLoad=lift/(mass*G);
  s.mach=V/atmosphere.speedOfSound;
  s.distance+=Math.hypot(s.x-previous.x,s.z-previous.z);
  s.fuel=clamp(s.fuel-s.throttle*dt/36000,0,1);
  return s;
}
