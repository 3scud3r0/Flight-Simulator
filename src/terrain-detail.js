/**
 * Mesh density follows the aircraft instead of being identical across
 * 25 resident tiles. The physics height sampler is unchanged and always
 * operates in world metres, independently from the visible mesh.
 */
export function terrainSubdivisions(dx,dz,{
 mobile=false,compatibility=false
}={}){
 if(!Number.isInteger(dx)||!Number.isInteger(dz))
  throw new RangeError("LOD offsets must be integer tile coordinates");
 if(compatibility)return 14;
 const ring=Math.max(Math.abs(dx),Math.abs(dz));
 if(mobile)return ring===0?32:16;
 return ring===0?96:ring===1?48:20;
}
