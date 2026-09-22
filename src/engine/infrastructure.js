/** Algorithms 143–154: optional procedural infrastructure and AI planning. */
import {clamp,lerp,vec,add,sub,mul,norm,hash,rng} from "./math.js";
export function proceduralRoadNetwork(points){
 if(points.length<2)return [];const connected=new Set([0]),edges=[];
 while(connected.size<points.length){let candidate=null,shortest=Infinity;
 for(const i of connected)for(let j=0;j<points.length;j++){if(connected.has(j))continue;
 const a=points[i],b=points[j],cost=Math.hypot(a.x-b.x,a.z-b.z);
 if(cost<shortest){shortest=cost;candidate=[i,j]}}
 if(!candidate)break;edges.push({from:candidate[0],to:candidate[1],length:shortest});
 connected.add(candidate[1]);}return edges;
}
export function urbanZoning(distanceToCenter,slope,nearPort,population){
 const urban=clamp(1-distanceToCenter/18000)*clamp(1-slope);
 const industrial=clamp(nearPort)*clamp(population)*.8;
 const residential=clamp(urban-industrial*.3),commercial=clamp(urban*urban);
 const rural=clamp(1-urban);return {residential,commercial,industrial,rural};
}
export function architecturalGrammar(lot,{floors=5,roof="flat",setback=1}={}){
 const center=vec(lot.x,0,lot.z),footprint={
 width:Math.max(2,lot.width-2*setback),depth:Math.max(2,lot.depth-2*setback)};
 return {footprint,center,height:floors*3.2,roof,
 windows:Math.max(1,Math.floor(footprint.width/2.2))*floors,
 columns:Math.max(1,Math.floor(footprint.width/5))};
}
export function airportLayout(center,heading,runways){
 const f={x:Math.sin(heading),z:-Math.cos(heading)},
 right={x:Math.cos(heading),z:Math.sin(heading)};
 return runways.map((r,i)=>{const shift=(i-(runways.length-1)/2)*(r.spacing||350);
 return {center:{x:center.x+right.x*shift,z:center.z+right.z*shift},
 heading,length:r.length,width:r.width,
 threshold:{x:center.x+right.x*shift-f.x*r.length/2,
 z:center.z+right.z*shift-f.z*r.length/2}}});
}
export function proceduralRunwayMarkings(length,width,interval=60){
 const marks=[];for(let d=-length/2+50;d<length/2-50;d+=interval)
 marks.push({type:"centerline",distance:d,width:1.4,length:Math.min(32,interval*.6)});
 for(const side of [-1,1])marks.push({
 type:"edge",offset:side*(width/2-1),distance:0,length});
 return marks;
}
export function aerodromeLights(runway,{spacing=80,thresholdCount=10}={}){
 const lights=[];for(let d=-runway.length/2;d<=runway.length/2;d+=spacing)
 for(const side of [-1,1])lights.push({along:d,across:side*runway.width/2,
 color:"white",kind:"edge"});
 for(let i=0;i<thresholdCount;i++)lights.push({
 along:-runway.length/2,across:(i/(thresholdCount-1)-.5)*runway.width,
 color:"green",kind:"threshold"});
 return lights;
}
export function vegetationDistribution(bounds,density,accept,seed=1,maxCandidates=30000){
 const random=rng(seed),result=[],count=Math.min(maxCandidates,Math.ceil(
 bounds.width*bounds.height*Math.max(0,density)));
 for(let i=0;i<count;i++){const x=bounds.x+random()*bounds.width,
 z=bounds.z+random()*bounds.height;
 if(accept(x,z))result.push({x,z,height:2+random()*15,variant:Math.floor(random()*6)})}
 return result;
}
export function aggregateGroundTraffic(links,vehicleCount,dt,speed=12){
 return [...Array(vehicleCount)].map((_,i)=>{const road=links[i%links.length];
 if(!road)return null;const t=((i*.61803398+dt*speed/Math.max(1,road.length))%1+1)%1;
 return {road:i%links.length,t}}).filter(Boolean);
}
export function aerialTrafficRoutes(airports,minimumSpacing=12000){
 const routes=[];for(let i=0;i<airports.length;i++)for(let j=i+1;j<airports.length;j++){
 const a=airports[i],b=airports[j],distance=Math.hypot(a.x-b.x,a.z-b.z);
 if(distance>=minimumSpacing)routes.push({from:a.id,to:b.id,distance,
 cruiseAltitude:Math.max(1600,Math.min(11000,distance*.08))});}
 return routes;
}
export function trafficStateMachine(state,event){
 const transitions={
 parked:{clearance:"taxi"},taxi:{lineup:"holding",park:"parked"},
 holding:{takeoff:"departing"},departing:{climb:"cruise"},
 cruise:{arrival:"approach"},approach:{land:"landing",goaround:"cruise"},
 landing:{exit:"taxi"}};
 return transitions[state]?.[event]||state;
}
export function fictionalATC(aircraft,traffic,runway){
 const occupied=traffic.some(t=>t.runway===runway.id&&
 ["departing","landing","holding"].includes(t.state));
 return occupied?{clearance:false,message:"Aguarde: pista ocupada"}:{
 clearance:true,message:aircraft.state==="approach"?
 "Autorizado para pouso na pista "+runway.id:
 "Autorizado para decolar da pista "+runway.id};
}
export function obstacleAvoidingPath(nodes,start,goal,edges,heuristic){
 const open=[start],g=new Map([[start,0]]),prev=new Map(),closed=new Set();
 while(open.length){open.sort((a,b)=>
 (g.get(a)||0)+heuristic(a,goal)-(g.get(b)||0)-heuristic(b,goal));
 const cur=open.shift();if(cur===goal){
 const path=[cur];while(prev.has(path[0]))path.unshift(prev.get(path[0]));
 return {path,cost:g.get(cur)}}
 if(closed.has(cur))continue;closed.add(cur);
 for(const next of edges(cur)){if(closed.has(next.node))continue;
 const cost=g.get(cur)+next.cost;if(cost<(g.get(next.node)??Infinity)){
 g.set(next.node,cost);prev.set(next.node,cur);open.push(next.node)}}}
 return {path:[],cost:Infinity};
}
export const algorithms=[proceduralRoadNetwork,urbanZoning,architecturalGrammar,
 airportLayout,proceduralRunwayMarkings,aerodromeLights,
 vegetationDistribution,aggregateGroundTraffic,aerialTrafficRoutes,
 trafficStateMachine,fictionalATC,obstacleAvoidingPath];
