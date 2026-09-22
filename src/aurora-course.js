/** Authored sightseeing run: coast → lighthouse → bridge → village. */
import {RING_COUNT,RING_RADIUS} from "./challenge.js";

const ROUTE=Object.freeze([
 [4000,1650],[3650,810],[4020,100],[4290,-620],
 [3900,-900],[3200,-700],[2460,-650],[1780,-330],
 [900,180],[50,610],[-950,880]
]);

/** Renders exactly the same gate shape consumed by the shared challenge physics. */
export function createAuroraCourse(origin,terrainHeight){
 const route=[[origin.x,origin.z],...ROUTE.slice(1)];
 const distances=[0];
 for(let i=1;i<route.length;i++)
  distances[i]=distances[i-1]+Math.hypot(
   route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);
 const total=distances.at(-1),rings=[];
 for(let i=0;i<RING_COUNT;i++){
  const distance=Math.min(total-20,250+(total-300)*i/(RING_COUNT-1));
  let segment=1;
  while(segment<distances.length-1&&distances[segment]<distance)segment++;
  const start=route[segment-1],end=route[segment];
  const amount=(distance-distances[segment-1])/
   (distances[segment]-distances[segment-1]);
  const x=start[0]+(end[0]-start[0])*amount;
  const z=start[1]+(end[1]-start[1])*amount;
  const length=Math.hypot(end[0]-start[0],end[1]-start[1]);
  rings.push({index:i,x,z,
   y:Math.max(terrainHeight(x,z)+145,origin.y+25*Math.sin(i*.55)),
   radius:RING_RADIUS,
   normal:{x:(end[0]-start[0])/length,y:0,z:(end[1]-start[1])/length}});
 }
 return rings;
}
