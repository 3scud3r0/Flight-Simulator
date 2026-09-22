/**
 * Authored coastal boundary for Nova Iris. No imagery, remote tiles, or
 * changes to the Rio geodata. Called only by the megacity height domain.
 * The coastline stays kilometres away from its airport operating surfaces.
 */
const clamp01=v=>Math.max(0,Math.min(1,v));
const smooth=t=>t*t*(3-2*t);
export function novaIrisCoastHeight(x,z,inlandHeight){
 if(![x,z,inlandHeight].every(Number.isFinite))
  throw new RangeError("Coast inputs must be finite");
 // Fade the peninsula into the neighboring fictional biome domains.
 const west=smooth(clamp01((x+23500)/1500));
 const east=smooth(clamp01((-5500-x)/1500));
 const mask=west*east;
 if(!mask)return inlandHeight;
 // Continuous, gently warped shore rather than a perfectly straight edge.
 const coastZ=-5300+Math.sin((x+15400)*.00031)*430+
  Math.sin((x+7400)*.00087)*170;
 const sea=smooth(clamp01((z-coastZ)/580));
 const offshore=-18+Math.sin(x*.00023+z*.00018)*3;
 return inlandHeight+(offshore-inlandHeight)*sea*mask;
}
