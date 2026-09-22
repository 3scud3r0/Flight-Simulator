/**
 * Aetheria GPU world. Entirely original geometry and algorithmic material colour;
 * NO real-world imagery or external tile requests. One small terrain tile is built
 * at a time; physics reads the same analytic height function everywhere.
 * World units: metres, X east, Y up, Z south.
 */
import {
 AETHERIA_REGIONS,AETHERIA_AIRPORTS,AETHERIA_LANDMARKS,
 AETHERIA_SIZE,aetheriaRegionAt,aetheriaNearestAirport
} from "./aetheria-data.js";
import {Generation,Materials,Weather,Water,Streaming,Lighting,
 Performance} from "./engine/index.js";

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const CELL=5600;
const COUNTRY_SEED=314159;
/** Only the two closest domains contribute to height blending. */
export function aetheriaBiome(x,z){
 let a=null,b=null,da=Infinity,db=Infinity;
 for(const r of AETHERIA_REGIONS){
  const d=Math.hypot(x-r.x,z-r.z);
  if(d<da){b=a;db=da;a=r;da=d}
  else if(d<db){b=r;db=d}
 }
 // A smooth broad 80km transition; no square-grid terrain seams.
 const w=clamp(.5+(db-da)/160000);
 return {primary:a,secondary:b??a,blend:w};
}
function domainHeight(region,x,z){
 const seed=region.seed;
 const broad=Generation.fractalBrownianMotion(x*.000010,z*.000010,
  {seed,octaves:3})*230;
 const detail=Generation.ridgedMultifractal(x*.000025,z*.000025,
  {seed:seed+21,octaves:4});
 const micro=Generation.fractalBrownianMotion(x*.00022,z*.00022,
  {seed:seed+53,octaves:3})*27;
 const d=Math.hypot(x-region.x,z-region.z);
 let elevation=region.elevation;
 switch(region.biome){
 case "polar":elevation+=broad*.4+detail*180;break;
 case "glacial":elevation+=broad+detail*750;break;
 case "fjord":elevation+=broad*1.5+detail*920-
  Math.exp(-Math.abs(z-region.z)/12000)*350;break;
 case "alpine":elevation+=broad*2.2+detail*1700;break;
 case "desert":elevation+=broad*.7+
  Math.sin(x*.00011+Math.sin(z*.000032))*48;break;
 case "jungle":elevation+=broad*.7+detail*310;break;
 case "delta":elevation+=broad*.11+detail*38;break;
 case "highlands":elevation+=broad+detail*540;break;
 case "historic":case "megacity":case "industrial":
 case "futuristic":elevation+=broad*.3+detail*80;break;
 case "tropical":case "ocean":{
  // Large islands / lagoons; preserves ocean between many land masses.
  const island=Math.max(0,Math.sin(x*.000027)+
   Math.cos(z*.000033)+
   Generation.fractalBrownianMotion(x*.000019,z*.000019,
    {seed:seed+6,octaves:3})*1.2);
  elevation=region.biome==="ocean"?-68:-22;
  elevation+=island*island*(region.biome==="ocean"?52:94);
  break;
 }
 case "storm":elevation+=broad*.32+detail*210;break;
 case "canyon":{
  const warp=Generation.domainWarp(x*.000015,z*.000015,seed,1.25);
  const channel=Math.exp(-Math.abs(
   Math.sin(warp.x*4.8+warp.y*1.5))*12);
  elevation+=broad+detail*570-channel*570;break;
 }
 case "volcanic":elevation+=broad*.7+detail*520;break;
 case "volcano":{
  elevation+=broad+detail*450+
   Generation.volcanicCaldera(x,z,{cx:region.x,cy:region.z,
    radius:48000,rim:2500,depth:1700});break;
 }
 case "meadow":elevation+=broad*.42+detail*115;break;
 case "fantasy":{
  // The ground is real within this fictional universe; suspended islands
  // are separate meshes and NEVER used as the collision ground.
  elevation+=broad*1.5+detail*720;break;
 }
 }
 return elevation+micro;
}
export function sampleAetheriaHeight(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
 const b=aetheriaBiome(x,z);
 let h=mix(domainHeight(b.secondary,x,z),
  domainHeight(b.primary,x,z),b.blend);
 const airport=aetheriaNearestAirport(x,z,6500);
 if(airport){
  const dist=Math.hypot(x-airport.x,z-airport.z);
  const t=clamp((dist-1050)/4400);
  const smooth=t*t*(3-2*t);
  h=mix(airport.elevation-1,h,smooth);
 }
 return clamp(h,-250,5200);
}
export function aetheriaWeatherAt(x,z,seconds,preset="limpo"){
 const region=aetheriaRegionAt(x,z);
 const wind=Weather.threeDimensionalWind(x,region.elevation+500,z,seconds,preset);
 const wet=Weather.cloudWeatherMap(x,z,seconds,{seed:region.seed});
 const storm=region.biome==="storm"?Math.max(.65,wet.storm):
  region.biome==="polar"||region.biome==="glacial"?wet.storm*.6:wet.storm;
 return {wind,storm,coverage:wet.coverage,region,
  visibilityMeters:Weather.meteorologicalVisibility(wet.humidity,
   storm*.32,preset==="névoa"?.6:0,region.biome==="desert"?.15:0)};
}
function disposeGroup(THREE,group,disposeMaterials=true){
 if(!group)return;
 const geos=new Set(),materials=new Set();
 group.traverse(node=>{if(node.isMesh){
  geos.add(node.geometry);
  const mat=Array.isArray(node.material)?node.material:[node.material];
  for(const m of mat)materials.add(m);
 }});
 group.removeFromParent();
 for(const g of geos)g.dispose();
 if(disposeMaterials)for(const m of materials)m.dispose();
}
export function createAetheriaWorld(THREE,scene,renderer,{mobile=false,
 compatibility=false}={}){
 const root=new THREE.Group();root.name="Aetheria_Procedural_World";
 scene.add(root);
 const tiles=new Map(),failed=new Set();
 const radius=compatibility?1:mobile?1:2;
 const subdivisions=compatibility?10:mobile?14:22;
 const material=new THREE.MeshStandardMaterial({
  vertexColors:true,roughness:.96,metalness:0,side:THREE.DoubleSide});
 const waterMaterial=new THREE.MeshStandardMaterial({
  color:0x145778,roughness:.31,metalness:.05,transparent:true,opacity:.96});
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(
  CELL*(radius*2+3),CELL*(radius*2+3),1,1),waterMaterial);
 sea.rotation.x=-Math.PI/2;sea.position.y=-.75;
 sea.receiveShadow=false;sea.name="Aetheria_Local_Ocean";
 root.add(sea);
 let airportGroup=new THREE.Group();airportGroup.name="Aetheria_Active_Airport";
 root.add(airportGroup);
 const nature=new THREE.Group();root.add(nature);
 const cloudMat=new THREE.MeshStandardMaterial({
  color:0xe9f0f4,transparent:true,opacity:.76,depthWrite:false,
  roughness:1});
 const cloudGeometry=new THREE.SphereGeometry(1,8,6);
 const cloudCount=compatibility?8:mobile?16:38;
 const clouds=new THREE.InstancedMesh(cloudGeometry,cloudMat,cloudCount);
 const dummy=new THREE.Object3D();
 for(let i=0;i<cloudCount;i++){
  const t=i*2.3999632297,rad=2500+Math.sqrt(i/cloudCount)*14500;
  dummy.position.set(Math.cos(t)*rad,1700+(i*311)%1800,
   Math.sin(t)*rad);
  dummy.scale.set(220+(i*37)%240,54+(i*13)%70,120+(i*59)%180);
  dummy.rotation.set(0,t,0);dummy.updateMatrix();
  clouds.setMatrixAt(i,dummy.matrix);
 }
 clouds.instanceMatrix.needsUpdate=true;clouds.frustumCulled=false;
 nature.add(clouds);
 const sun=new THREE.DirectionalLight(0xffe8bb,1.8);
 sun.position.set(7000,15000,1000);sun.castShadow=false;
 sun.shadow.mapSize.set(512,512);
 sun.shadow.camera.left=sun.shadow.camera.bottom=-2200;
 sun.shadow.camera.right=sun.shadow.camera.top=2200;
 sun.shadow.camera.far=36000;
 scene.add(sun,sun.target);
 const hemi=new THREE.HemisphereLight(0xa5d2ff,0x56604e,.9);
 scene.add(hemi);
 const runwayGlow=new THREE.MeshBasicMaterial({
  color:0xdceeff,transparent:true,opacity:0,toneMapped:false});
 let lastAirport=null,lastCenterX=Infinity,lastCenterZ=Infinity;
 let buildCounter=0,status="Gerando terreno ficcional…",currentRegion=null;
 let active=true,seconds=0,lastShadow=0;
 const airports=AETHERIA_AIRPORTS,landmarks=AETHERIA_LANDMARKS;
 function makeTile(ix,iz){
  const key=ix+":"+iz;if(tiles.has(key))return;
  const baseX=ix*CELL,baseZ=iz*CELL;
  const N=subdivisions,verts=[],colors=[],uv=[],indices=[];
  const color=new THREE.Color(),shore=new THREE.Color(0x1b7385);
  for(let row=0;row<=N;row++)for(let col=0;col<=N;col++){
   const x=baseX+col/N*CELL,z=baseZ+row/N*CELL;
   const y=sampleAetheriaHeight(x,z);
   const b=aetheriaBiome(x,z);
   const a=new THREE.Color(b.primary.landColor),
    second=new THREE.Color(b.secondary.landColor);
   color.copy(second).lerp(a,b.blend);
   if(y<4)color.lerp(shore,clamp((4-y)/18)*.75);
   else if(y>2600)color.lerp(new THREE.Color(0xe2eaf2),
    clamp((y-2600)/1700)*.8);
   const slope=Generation.fractalBrownianMotion(
    x*.00041,z*.00041,{seed:COUNTRY_SEED,octaves:2});
   color.multiplyScalar(.86+slope*.12);
   verts.push(col/N*CELL,y,row/N*CELL);
   colors.push(color.r,color.g,color.b);
   uv.push(col/N,row/N);
   if(row<N&&col<N){
    const i=row*(N+1)+col,c=i+N+1;
    indices.push(i,c,i+1,i+1,c,c+1);
   }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(baseX,0,baseZ);
  mesh.receiveShadow=true;mesh.castShadow=false;
  mesh.name="Aetheria_Terrain_"+key;
  root.add(mesh);tiles.set(key,mesh);
 }
 function clearTiles(){
  for(const mesh of tiles.values()){root.remove(mesh);mesh.geometry.dispose()}
  tiles.clear();
 }
 const airportMat=new THREE.MeshStandardMaterial({
  color:0x343d48,roughness:.89});
 const stripeMat=new THREE.MeshBasicMaterial({color:0xf0f5ed});
 const terminalMat=new THREE.MeshStandardMaterial({
  color:0x8f9eaa,metalness:.08,roughness:.69});
 const redMat=new THREE.MeshBasicMaterial({color:0xff4d43});
 const greenMat=new THREE.MeshBasicMaterial({color:0x43ee9f});
 const litMat=new THREE.MeshBasicMaterial({color:0xecf3db});
 function airportMesh(airport){
  disposeGroup(THREE,airportGroup,false);
  // The group itself is kept attached; disposeGroup removes all children.
  // Create a fresh child group so scene ownership stays explicit.
  const parent=new THREE.Group();root.add(parent);
  const rw=airport.runways[0],angle=-rw.heading*Math.PI/180;
  const surface=airport.elevation-.42;
  const runway=new THREE.Mesh(new THREE.BoxGeometry(
   rw.width,1,rw.length),airportMat);
  runway.position.set(airport.x,surface,airport.z);
  runway.rotation.y=angle;parent.add(runway);
  const heading=Math.PI*rw.heading/180;
  const f={x:Math.sin(heading),z:-Math.cos(heading)};
  for(let d=-rw.length/2+42;d<rw.length/2-32;d+=90){
   const dash=new THREE.Mesh(new THREE.BoxGeometry(
    1.7,.04,Math.min(37,rw.length/18)),stripeMat);
   dash.position.set(airport.x+f.x*d,surface+.53,
    airport.z+f.z*d);dash.rotation.y=angle;parent.add(dash);
  }
  for(let side of [-1,1]){
   const edge=new THREE.Mesh(new THREE.BoxGeometry(
    .52,.045,rw.length),stripeMat);
   edge.position.set(airport.x+Math.cos(heading)*side*(rw.width/2-1),
    surface+.55,airport.z+Math.sin(heading)*side*(rw.width/2-1));
   edge.rotation.y=angle;parent.add(edge);
  }
  // GPU instance batches instead of one draw call per edge light.
  const count=Math.ceil(rw.length/110);
  const lights=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,4),
   litMat,count*2);
  for(let i=0;i<count;i++)for(let j=0;j<2;j++){
   const d=-rw.length/2+i*rw.length/(count-1),side=j?1:-1;
   dummy.position.set(airport.x+f.x*d+Math.cos(heading)*side*rw.width*.53,
    surface+1.15,
    airport.z+f.z*d+Math.sin(heading)*side*rw.width*.53);
   dummy.scale.setScalar(.77);dummy.rotation.set(0,0,0);
   dummy.updateMatrix();lights.setMatrixAt(i*2+j,dummy.matrix);
  }
  lights.instanceMatrix.needsUpdate=true;parent.add(lights);
  for(let k=0;k<(airport.category==="internacional"?9:3);k++){
   const h=8+(k*13)%21;
   const terminal=new THREE.Mesh(new THREE.BoxGeometry(
    20+(k%3)*10,h,18+(k%4)*8),terminalMat);
   terminal.position.set(airport.x+230+(k%3)*37,surface+h/2,
    airport.z+Math.floor(k/3)*50);parent.add(terminal);
  }
  airportGroup=parent;
 }
 function updateEnvironment(hour,weather,dt){
  seconds+=Math.max(0,dt);
  const daylight=clamp(Math.sin((hour-5)/14*Math.PI),.03,1);
  sun.intensity=(weather==="nublado"?1.1:2.1)*daylight;
  hemi.intensity=.19+daylight*.91;
  cloudMat.opacity=weather==="nublado"?.96:.75;
  renderer.toneMappingExposure=.37+daylight*.87;
  runwayGlow.opacity=daylight<.22?.95:.03;
  litMat.color.setRGB(.18+(1-daylight)*.82,
    .20+(1-daylight)*.81,.18+(1-daylight)*.77);
 }
 function update(x,z,dt=0){
  if(!active)return;
  const ix=Math.floor(x/CELL),iz=Math.floor(z/CELL);
  const desired=[];
  for(let dz=-radius;dz<=radius;dz++)
   for(let dx=-radius;dx<=radius;dx++){
    const tx=ix+dx,tz=iz+dz;
    desired.push({ix:tx,iz:tz,key:tx+":"+tz,dist:dx*dx+dz*dz});
   }
  desired.sort((a,b)=>a.dist-b.dist);
  const keep=new Set(desired.map(item=>item.key));
  for(const [key,mesh] of tiles)if(!keep.has(key)){
   root.remove(mesh);mesh.geometry.dispose();tiles.delete(key);
  }
  // One tile per update: never stall multiple physics/render frames.
  // Budget one chunk every fifth frame to protect input latency and mobile.
  if(!tiles.size||++buildCounter%5===0)
    for(const item of desired)if(!tiles.has(item.key)){
      makeTile(item.ix,item.iz);break;
    }
  if(Math.abs(lastCenterX-x)>500||Math.abs(lastCenterZ-z)>500){
   lastCenterX=x;lastCenterZ=z;
   sea.position.set(x,-.75,z);
   nature.position.set(x,0,z);
   sun.target.position.set(x,0,z);
   sun.position.set(x+7800,15000,z+3200);
   currentRegion=aetheriaRegionAt(x,z);
   const near=aetheriaNearestAirport(x,z,12000);
   if((near?.id||null)!==lastAirport){
    lastAirport=near?.id||null;
    if(near)airportMesh(near);
    else if(airportGroup){disposeGroup(THREE,airportGroup,false);
     airportGroup=new THREE.Group();root.add(airportGroup)}
   }
  }
  status="Aetheria · "+(currentRegion?.name||"Mundo")+
    " · "+tiles.size+"/"+((radius*2+1)**2)+" blocos";
 }
 function dispose(){
  active=false;clearTiles();
  disposeGroup(THREE,airportGroup);
  root.remove(sea);sea.geometry.dispose();
  disposeGroup(THREE,nature);
  disposeGroup(THREE,root);
  waterMaterial.dispose();material.dispose();airportMat.dispose();
  stripeMat.dispose();terminalMat.dispose();redMat.dispose();
  greenMat.dispose();litMat.dispose();runwayGlow.dispose();
  scene.remove(sun,sun.target,hemi);
 }
 return {root,sun,hemi,sea,cloudMat,runwayGlow,airports,landmarks,
  sampleHeight:sampleAetheriaHeight,updateEnvironment,update,dispose,
  setRealTerrainEnabled(){},
  get region(){return currentRegion},
  get tileCount(){return tiles.size},
  get status(){return status},
  get tileLimit(){return (radius*2+1)**2}
 };
}
