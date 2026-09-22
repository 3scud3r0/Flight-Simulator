/**
 * Nova Iris' globally aligned street grid. The planner allocates no GPU
 * resources, never modifies terrain, and owns only road sections inside its
 * tile, so streaming does not duplicate the neighboring tile's streets.
 */
export const STREET_GRID = 360;
export const STREET_WIDTH = 16;
const CITY={x:-11700,z:-8600,radius:8700};
const CELL=2400;
const land=(value)=>Number.isFinite(value)&&value>2;
const inTile=(value,min)=>value>=min&&value<min+CELL;

/** Returns road boxes and lamp placements in world metres. */
export function planUrbanGridTile(ix,iz,{
 sampleHeight,regionAt,clearance,mobile=false
}={}){
 if(!Number.isSafeInteger(ix)||!Number.isSafeInteger(iz))
  throw new RangeError("Invalid urban tile indices");
 for(const [key,fn] of Object.entries({sampleHeight,regionAt,clearance}))
  if(typeof fn!=="function")throw new TypeError(key+" must be a function");
 const sx=ix*CELL,sz=iz*CELL;
 if(regionAt(sx+CELL/2,sz+CELL/2)?.biome!=="megacity")
  return {roads:[],lamps:[]};
 const roads=[],lamps=[];
 const length=mobile?200:100;
 const steps=CELL/length;
 const withinCity=(x,z)=>Math.hypot(x-CITY.x,z-CITY.z)<CITY.radius;
 const safe=(x,z)=>clearance(x,z)&&withinCity(x,z);
 for(const axis of ["x","z"]){
  const base=axis==="x"?sz:sx;
  // Parallel roads use a global 360 m grid; segment ownership uses a
  // tile-global half-open interval independent of the player position.
  const first=Math.ceil(base/STREET_GRID)*STREET_GRID;
  for(let fixed=first;inTile(fixed,base);fixed+=STREET_GRID)
   for(let i=0;i<steps;i++){
    const center=axis==="x"?
     {x:sx+(i+.5)*length,z:fixed}:
     {x:fixed,z:sz+(i+.5)*length};
    const ax=axis==="x"?center.x-length/2:center.x;
    const az=axis==="z"?center.z-length/2:center.z;
    const bx=axis==="x"?center.x+length/2:center.x;
    const bz=axis==="z"?center.z+length/2:center.z;
    if(!safe(center.x,center.z)||!safe(ax,az)||!safe(bx,bz))
     continue;
    const a=sampleHeight(ax,az),b=sampleHeight(bx,bz);
    const mid=sampleHeight(center.x,center.z);
    if(!land(a)||!land(b)||!land(mid))continue;
    const peak=Math.max(a,b,mid),lowest=Math.min(a,b,mid);
    if(peak-lowest>(mobile?3.5:2.5))continue;
    const y=peak+.14;
    roads.push({x:center.x,z:center.z,y,length,width:STREET_WIDTH,axis});
    // Lamps have no dynamic lights: their emissive meshes illuminate visually
    // at night without allocating hundreds of punctual light sources.
    if(i%3!==1)continue;
    const sides=mobile?[1]:[-1,1];
    for(const side of sides){
     const x=center.x+(axis==="x"?0:side*(STREET_WIDTH/2+4));
     const z=center.z+(axis==="x"?side*(STREET_WIDTH/2+4):0);
     if(!safe(x,z))continue;
     const ground=sampleHeight(x,z);
     if(!land(ground)||Math.abs(ground-mid)>2.5)continue;
     lamps.push({x,z,y:ground,height:8});
    }
   }
 }
 return {roads,lamps};
}
