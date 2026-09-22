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
// Import ONLY the numerical kernels used by this world. Importing
// engine/index.js pulled all 180 kernels and their transitive dependencies
// through one delayed network request, causing an avoidable load failure.
import * as Generation from "./engine/generation.js";
import * as Weather from "./engine/weather.js";
import * as Infrastructure from "./engine/infrastructure.js";
import {createAssetLibrary} from "./asset-library.js";

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const CELL=2400;
const COUNTRY_SEED=314159;
/** Only the two closest domains contribute to height blending. */
export function aetheriaBiome(x,z){
 let a=null,b=null,da=Infinity,db=Infinity;
 for(const r of AETHERIA_REGIONS){
  const d=Math.hypot(x-r.x,z-r.z);
  if(d<da){b=a;db=da;a=r;da=d}
  else if(d<db){b=r;db=d}
 }
 // Local 3.6 km biome blend — never one color block per continent.
 const w=clamp(.5+(db-da)/7200);
 return {primary:a,secondary:b??a,blend:w};
}
function domainHeight(region,x,z){
 const seed=region.seed;
 const broad=Generation.fractalBrownianMotion(x*.000045,z*.000045,
  {seed,octaves:4})*175;
 const detail=Generation.ridgedMultifractal(x*.000095,z*.000095,
  {seed:seed+21,octaves:4});
 const micro=Generation.fractalBrownianMotion(x*.00048,z*.00048,
  {seed:seed+53,octaves:2})*17;
 const d=Math.hypot(x-region.x,z-region.z);
 let elevation=region.elevation;
 switch(region.biome){
 case "polar":elevation+=broad*.4+detail*180;break;
 case "glacial":elevation+=broad+detail*750;break;
 case "fjord":elevation+=broad*1.5+detail*920-
  Math.exp(-Math.abs(z-region.z)/12000)*350;break;
 case "alpine":elevation+=broad*1.35+detail*1250;break;
 case "desert":elevation+=broad*.7+
  Math.sin(x*.00011+Math.sin(z*.000032))*48;break;
 case "jungle":elevation+=broad*.65+detail*260;break;
 case "delta":elevation+=broad*.11+detail*38;break;
 case "highlands":elevation+=broad+detail*540;break;
 case "historic":case "megacity":case "industrial":
 case "futuristic":elevation+=broad*.15+detail*48;break;
 case "tropical":case "ocean":{
  // Large islands / lagoons; preserves ocean between many land masses.
  const island=Math.max(0,Math.sin(x*.00018)+
   Math.cos(z*.00014)+
   Generation.fractalBrownianMotion(x*.000065,z*.000065,
    {seed:seed+6,octaves:3})*1.25);
  elevation=region.biome==="ocean"?-68:-20;
  elevation+=island*island*(region.biome==="ocean"?52:86);
  if(region.id==="auralis"){
   const d=Math.hypot(x-11500,z+8100);
   elevation+=65*Math.exp(-Math.pow(d/3700,2));
  }
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
 const airport=aetheriaNearestAirport(x,z,5000);
 if(airport){
  // The ENTIRE runway, thresholds and sides are level, not just
  // a circular plateau at the airport reference point.
  const heading=airport.heading*Math.PI/180;
  const dx=x-airport.x,dz=z-airport.z;
  const along=dx*Math.sin(heading)-dz*Math.cos(heading);
  const lateral=dx*Math.cos(heading)+dz*Math.sin(heading);
  const end=Math.max(0,Math.abs(along)-airport.runways[0].length/2-190);
  const side=Math.max(0,Math.abs(lateral)-280);
  const t=clamp(Math.hypot(end,side)/1550);
  h=mix(airport.elevation-1,h,t*t*(3-2*t));
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
 const subdivisions=compatibility?14:mobile?20:42;
 // Reusable original 128px microtexture; no imagery API or downloads.
 // All terrain tiles share one GPU texture, avoiding per-tile allocations.
 const textureCanvas=document.createElement("canvas");
 const textureSize=compatibility||mobile?64:128;
 textureCanvas.width=textureCanvas.height=textureSize;
 const textureContext=textureCanvas.getContext("2d");
 if(!textureContext)throw Error("Canvas 2D unavailable for procedural soil");
 const texturePixels=textureContext.createImageData(textureSize,textureSize);
 for(let row=0;row<textureSize;row++)
  for(let col=0;col<textureSize;col++){
   const i=(row*textureSize+col)*4;
   const n=Math.sin(col*91.77+row*37.63)*
    Math.cos(col*14.17-row*42.11);
   const v=Math.round(225+n*19);
   texturePixels.data[i]=v;
   texturePixels.data[i+1]=v;
   texturePixels.data[i+2]=v;
   texturePixels.data[i+3]=255;
  }
 textureContext.putImageData(texturePixels,0,0);
 const soilTexture=new THREE.CanvasTexture(textureCanvas);
 soilTexture.colorSpace=THREE.SRGBColorSpace;
 soilTexture.wrapS=soilTexture.wrapT=THREE.RepeatWrapping;
 soilTexture.repeat.set(10,10);
 soilTexture.anisotropy=Math.min(4,
  renderer.capabilities.getMaxAnisotropy?.()||2);
 const material=new THREE.MeshStandardMaterial({
  vertexColors:true,map:soilTexture,roughness:.96,
  metalness:0,side:THREE.DoubleSide});
 const groundMaterials=new Map(["earth","sand","rock","asphalt"].map(type=>
  [type,new THREE.MeshStandardMaterial({vertexColors:true,
   map:soilTexture,roughness:type==="asphalt"?.94:.99,
   metalness:0,side:THREE.DoubleSide})]));
 const pbrTextures=[];
 let pbrReady=0;
 if(typeof window!=="undefined"&&typeof THREE.TextureLoader==="function"){
  const texLoader=new THREE.TextureLoader();
  for(const [type,file] of [
   ["earth","gravel_ground_01_diff_1k.png"],
   ["sand","aerial_beach_01_diff_1k.png"],
   ["rock","rocks_ground_06_diff_1k.png"],
   ["asphalt","aerial_asphalt_01_diff_1k.png"]])
    texLoader.load(new URL("../assets/pbr/"+file,import.meta.url).href,
     texture=>{
      if(!active){texture.dispose();return}
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(14,14);
      texture.anisotropy=Math.min(4,
       renderer.capabilities.getMaxAnisotropy?.()||2);
      const mat=groundMaterials.get(type);
      mat.map=texture;mat.needsUpdate=true;
      if(type==="asphalt"){
       airportMat.map=texture;
       airportMat.color.set(0xffffff);
       airportMat.needsUpdate=true;
      }
      pbrTextures.push(texture);pbrReady++;
     },undefined,()=>{});
  for(const [type,file] of [
   ["earth","gravel_ground_01_nor_gl_1k.png"],
   ["rock","rocks_ground_06_nor_gl_1k.png"],
   ["asphalt","aerial_asphalt_01_nor_gl_1k.png"]])
    texLoader.load(new URL("../assets/pbr/"+file,import.meta.url).href,
     texture=>{
      if(!active){texture.dispose();return}
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(14,14);
      texture.anisotropy=Math.min(4,
       renderer.capabilities.getMaxAnisotropy?.()||2);
      const mat=groundMaterials.get(type);
      mat.normalMap=texture;
      mat.normalScale=new THREE.Vector2(.35,.35);
      mat.needsUpdate=true;
      if(type==="asphalt"){
       airportMat.normalMap=texture;
       airportMat.normalScale=new THREE.Vector2(.42,.42);
       airportMat.needsUpdate=true;
      }
      pbrTextures.push(texture);pbrReady++;
     },undefined,()=>{});
 }
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
 const assets=typeof window==="undefined"?null:
  createAssetLibrary(THREE,root,sampleAetheriaHeight,{mobile});
 const cloudMat=new THREE.MeshStandardMaterial({
  color:0xe9f0f4,transparent:true,opacity:.76,depthWrite:false,
  roughness:1});
 const cloudGeometry=new THREE.SphereGeometry(1,8,6);
 const cloudCount=compatibility?8:mobile?13:22;
 const clouds=new THREE.InstancedMesh(cloudGeometry,cloudMat,cloudCount);
 const dummy=new THREE.Object3D();
 for(let i=0;i<cloudCount;i++){
  const t=i*2.3999632297,rad=1400+Math.sqrt(i/cloudCount)*7800;
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
   // Albedo PBR already contains dark detail; avoid multiplying it by
   // a second dark biome tint (which made the entire city look black).
   color.lerp(new THREE.Color(0xffffff),.65);
   color.multiplyScalar(.96+slope*.07);
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
  const region=aetheriaRegionAt(baseX+CELL/2,baseZ+CELL/2);
  const type=["tropical","desert","ocean"].includes(region.biome)?
   "sand":["alpine","glacial","fjord","volcano","volcanic",
    "canyon","polar","fantasy"].includes(region.biome)?
     "rock":"earth";
  const mesh=new THREE.Mesh(geometry,groundMaterials.get(type)||material);
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
 function decorateAirport(airport,parent,surface){
  const region=AETHERIA_REGIONS.find(r=>r.id===airport.regionId);
  if(!region)return;
  let seed=region.seed+Number(airport.id.slice(3))*417;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;
    return(seed>>>0)/4294967296;};
  const urban=["megacity","futuristic","industrial","historic"].includes(
    region.biome)||airport.category==="internacional";
  if(urban){
    const count=compatibility?18:mobile?54:
      region.biome==="megacity"||region.biome==="futuristic"?95:65;
    const palettes=region.biome==="futuristic"?
      [0x38405e,0x51577e,0x6c4c87,0x3f6581]:
      region.biome==="historic"?
      [0xd0bea1,0xb4a889,0xc3a882,0xa3b5ab]:
      [0x647988,0x91a8b4,0x84909a,0x9eacb5];
    const meshes=palettes.map(color=>new THREE.InstancedMesh(
      new THREE.BoxGeometry(1,1,1),
      new THREE.MeshStandardMaterial({color,metalness:.1,roughness:.7,
        emissive:region.biome==="futuristic"?0x0d102a:0x020707,
        emissiveIntensity:.38}),Math.ceil(count/palettes.length)));
    const sizes=new Int32Array(4);
    for(let i=0;i<count;i++){
      const angle=random()*Math.PI*2,dist=3900+random()*8700;
      const x=airport.x+Math.cos(angle)*dist,
        z=airport.z+Math.sin(angle)*dist;
      // Keep runways and taxi approaches legible.
      if(Math.abs(x-airport.x)<280&&Math.abs(z-airport.z)<3500)
        continue;
      const h=(region.biome==="megacity"||region.biome==="futuristic"?
        25+Math.pow(random(),1.9)*340:
        8+Math.pow(random(),1.5)*85);
      const footprint=Infrastructure.architecturalGrammar({
        x,z,width:14+random()*33,depth:12+random()*33
      },{floors:Math.max(1,Math.round(h/3.2))});
      const index=i%palettes.length,slot=sizes[index]++;
      if(slot>=meshes[index].count)continue;
      dummy.position.set(x,Math.max(-1,sampleAetheriaHeight(x,z))+
        h/2,z);
      dummy.scale.set(footprint.footprint.width,h,
        footprint.footprint.depth);
      dummy.rotation.set(0,random()*.45,0);dummy.updateMatrix();
      meshes[index].setMatrixAt(slot,dummy.matrix);
    }
    meshes.forEach(mesh=>{
      mesh.count=sizes[meshes.indexOf(mesh)];
      if(mesh.count){mesh.instanceMatrix.needsUpdate=true;parent.add(mesh)}
      else{mesh.geometry.dispose();mesh.material.dispose()}
    });
  }
  const forest=compatibility&&["jungle","meadow","highlands","fjord",
    "polar","glacial","tropical","alpine"].includes(region.biome);
  if(forest){
    const count=compatibility?25:mobile?55:145;
    const cold=["polar","glacial","alpine"].includes(region.biome);
    const tree=new THREE.InstancedMesh(
      cold?new THREE.IcosahedronGeometry(1,0):
        new THREE.ConeGeometry(1,1,5),
      new THREE.MeshStandardMaterial({color:cold?0xbed1d4:
        region.biome==="tropical"?0x2a7354:0x38674c,
        roughness:.99}),count);
    let placed=0;
    for(let i=0;i<count;i++){
      const theta=random()*Math.PI*2,d=1500+random()*6500;
      const x=airport.x+Math.cos(theta)*d,
        z=airport.z+Math.sin(theta)*d;
      const height=cold?5+random()*16:12+random()*32;
      dummy.position.set(x,sampleAetheriaHeight(x,z)+height/2,z);
      dummy.scale.set(cold?3+random()*5:3+random()*3,
        height,cold?3+random()*5:3+random()*3);
      dummy.rotation.set(0,theta,0);dummy.updateMatrix();
      tree.setMatrixAt(placed++,dummy.matrix);
    }
    tree.count=placed;tree.instanceMatrix.needsUpdate=true;
    parent.add(tree);
  }
  if(region.biome==="fantasy"){
    // Artistic floating terrain is DECORATIVE, not part of collision DEM.
    const rock=new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1,1),
      new THREE.MeshStandardMaterial({color:0x6873aa,
        roughness:.81,flatShading:true,emissive:0x09051c}),12);
    for(let i=0;i<12;i++){
      const theta=i*2.399963,dist=2400+random()*6400;
      const x=airport.x+Math.cos(theta)*dist,
        z=airport.z+Math.sin(theta)*dist;
      const h=140+random()*350;
      dummy.position.set(x,airport.elevation+550+random()*2100,z);
      dummy.scale.set(140+random()*230,h,130+random()*200);
      dummy.rotation.set(random(),theta,random());dummy.updateMatrix();
      rock.setMatrixAt(i,dummy.matrix);
    }
    rock.instanceMatrix.needsUpdate=true;parent.add(rock);
  }
 }
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
  // Each biome creates its own ORIGINAL visual silhouette near airports.
  // These are instanced meshes rather than hundreds of draw calls.
  decorateAirport(airport,parent,surface);
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
  if(assets){
   const region=AETHERIA_REGIONS.find(r=>r.id===airport.regionId);
   if(region)assets.place(airport,region).catch(error=>
     console.warn("[Aetheria] CC0 scenery failed",error));
  }
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
  // Prewarm aircraft vicinity to avoid ocean-coloured holes at spawn.
  if(!tiles.size)for(const item of desired.slice(0,5))
    makeTile(item.ix,item.iz);
  else if(++buildCounter%4===0)
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
    else if(airportGroup){assets?.reset();
     disposeGroup(THREE,airportGroup,false);
     airportGroup=new THREE.Group();root.add(airportGroup)}
   }
  }
  status="Aetheria · "+(currentRegion?.name||"Mundo")+
    " · "+tiles.size+"/"+((radius*2+1)**2)+" blocos"+
    (assets?" · "+assets.count+" objetos CC0":"")+
    (pbrReady?" · "+pbrReady+" materiais PBR":"");
 }
 function dispose(){
  active=false;clearTiles();
  assets?.dispose();
  disposeGroup(THREE,airportGroup);
  root.remove(sea);sea.geometry.dispose();
  disposeGroup(THREE,nature);
  disposeGroup(THREE,root);
  waterMaterial.dispose();material.dispose();
  for(const mat of groundMaterials.values())mat.dispose();
  for(const texture of pbrTextures)texture.dispose();
  soilTexture.dispose();
  airportMat.dispose();
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
  get tileLimit(){return (radius*2+1)**2},
  get assetCount(){return assets?.count??0},
  get uniqueAssets(){return assets?.unique??0},
  get pbrCount(){return pbrReady}
 };
}
