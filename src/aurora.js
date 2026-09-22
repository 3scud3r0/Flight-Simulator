/** Ilhas de Aurora: a self-contained original archipelago with authored landmarks. */
import {AURORA_AIRPORTS,AURORA_LANDMARKS,AURORA_SIZE,sampleAuroraHeight} from './aurora-data.js';
export {sampleAuroraHeight} from './aurora-data.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const randSeed=(seed)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
export function createAuroraWorld(THREE,scene,renderer,{mobile=false,compatibility=false}={}){
 const root=new THREE.Group();root.name='Ilhas_de_Aurora';scene.add(root);
 const resources=new Set(),materials=new Set();
 const geo=(g)=>{resources.add(g);return g},mat=(m)=>{materials.add(m);return m};
 const std=(color,extra={})=>mat(new THREE.MeshStandardMaterial({color,roughness:.88,...extra}));
 const basic=(color,extra={})=>mat(new THREE.MeshBasicMaterial({color,...extra}));
 const grass=std(0xffffff,{vertexColors:true,roughness:.94,side:THREE.DoubleSide});
 const rock=std(0x879591,{roughness:.94,flatShading:true});
 const stone=std(0xc7bd9f),wood=std(0x796254),roof=std(0x9f5360),roofAlt=std(0x5c8791);
 const leaf=std(0x2e7758,{flatShading:true}),leafAlt=std(0x51936b,{flatShading:true});
 const white=basic(0xf3f0e6),yellow=basic(0xffcf78),red=std(0xbb4b44);
 const asphalt=std(0x414f54,{roughness:.97}),blue=std(0x245a7a,{metalness:.12,roughness:.31});
 const glass=std(0xbdd7d7,{metalness:.28,roughness:.24,emissive:0x213c46,emissiveIntensity:.4});
 const emissive=basic(0xffeab7,{toneMapped:false});
 const make=(g,m,parent=root,name='')=>{const o=new THREE.Mesh(g,m);o.name=name;parent.add(o);return o};
 function box(parent,w,h,d,m,x,y,z,angle=0){const o=make(geo(new THREE.BoxGeometry(w,h,d)),m,parent);
  o.position.set(x,y,z);o.rotation.y=angle;return o}
 const water=std(0x156783,{roughness:.31,metalness:.13,transparent:true,opacity:.94,side:THREE.DoubleSide});
 const sea=make(geo(new THREE.PlaneGeometry(28000,26000)),water,root,'Aurora_Ocean');
 sea.rotation.x=-Math.PI/2;sea.position.y=-.6;sea.receiveShadow=false;
 // A single medium-resolution mesh preserves the full five-island silhouette at any camera position.
 const NX=compatibility?122:mobile?150:172,NZ=compatibility?104:mobile?126:146;
 const verts=[],colors=[],uv=[],indices=[];
 const deep=new THREE.Color(0x416471),sand=new THREE.Color(0xf0d6a4),
  meadow=new THREE.Color(0x93b77b),forest=new THREE.Color(0x77a17d),
  cliff=new THREE.Color(0xc1bba3),summit=new THREE.Color(0xdfd4bd),c=new THREE.Color();
 for(let iz=0;iz<=NZ;iz++)for(let ix=0;ix<=NX;ix++){
  const x=(ix/NX-.5)*AURORA_SIZE.width,z=(iz/NZ-.5)*AURORA_SIZE.height;
  const y=sampleAuroraHeight(x,z),noise=Math.sin(x*.009+z*.002)*Math.sin(z*.01-x*.003);
  verts.push(x,y,z);uv.push(ix/NX,iz/NZ);
  if(y<1)c.copy(deep).lerp(sand,clamp((y+16)/18));
  else if(y<11)c.copy(sand).lerp(meadow,clamp((y-1)/10));
  else if(y<90)c.copy(meadow).lerp(forest,clamp((y-30)/140));
  else c.copy(cliff).lerp(summit,clamp((y-100)/190));
  c.multiplyScalar(1.3+noise*.05);colors.push(c.r,c.g,c.b);
  if(ix<NX&&iz<NZ){const a=iz*(NX+1)+ix,b=a+NX+1;
   indices.push(a,b,a+1,a+1,b,b+1)}
 }
 const terrainGeo=geo(new THREE.BufferGeometry());
 terrainGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 terrainGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 terrainGeo.setIndex(indices);terrainGeo.computeVertexNormals();
 const terrain=make(terrainGeo,grass,root,'Aurora_Terrain');terrain.receiveShadow=true;
 // Pier, tiny harbor and curved coastal village street.
 const dock=box(root,265,3,36,wood,-1050,4.5,1700,-.25);
 for(let i=0;i<5;i++)box(root,8,20,8,wood,-1165+i*53,-5,1730-i*14);
 const houseRandom=randSeed(7183);
 for(let i=0;i<(compatibility?15:mobile?24:36);i++){
  const angle=i*2.399963,rad=35+Math.sqrt(i)*99;
  const x=-950+Math.cos(angle)*rad,z=860+Math.sin(angle)*rad;
  const h=sampleAuroraHeight(x,z);if(h<7||h>75)continue;
  const size=14+houseRandom()*13,stories=7+houseRandom()*6;
  const local=new THREE.Group();local.position.set(x,h,z);local.rotation.y=houseRandom()*Math.PI;root.add(local);
  box(local,size,stories,size*.75,i%4===0?stone:i%3===0?wood:white,0,stories/2,0);
  const r=make(geo(new THREE.ConeGeometry(size*.79,7,4)),i%3===0?roofAlt:roof,local);
  r.position.y=stories+3;r.rotation.y=Math.PI/4;
  box(local,size*.15,2,.35,glass,-size*.22,stories*.64,size*.38);
  box(local,size*.15,2,.35,glass,size*.22,stories*.64,size*.38);
 }
 // Runway axis corresponds exactly to the elevation plateau and spawn heading.
 const a=AURORA_AIRPORTS[0],theta=a.heading*Math.PI/180,rot=-theta;
 const forward={x:Math.sin(theta),z:-Math.cos(theta)},right={x:Math.cos(theta),z:Math.sin(theta)};
 const runway=box(root,34,.42,1100,asphalt,a.x,15.24,a.z,rot);runway.name='Aurora_Runway_04_22';
 for(let s of [-1,1])box(root,.6,.08,1090,white,a.x+s*right.x*15.5,15.51,a.z+s*right.z*15.5,rot);
 for(let d=-475;d<=475;d+=65)box(root,1.1,.09,28,white,
  a.x+forward.x*d,15.52,a.z+forward.z*d,rot);
 for(let d of [-488,488])for(let side of [-9,-5,5,9])box(root,1.4,.1,22,white,
  a.x+forward.x*d+right.x*side,15.53,a.z+forward.z*d+right.z*side,rot);
 const apronX=a.x+right.x*125,apronZ=a.z+right.z*125;
 box(root,190,.28,155,asphalt,apronX,15.15,apronZ,rot);
 box(root,115,.30,17,asphalt,a.x+right.x*65,15.15,a.z+right.z*65,rot);
 box(root,100,16,32,stone,apronX+right.x*30,23.5,apronZ+forward.z*55,rot);
 const hangar=box(root,46,15,46,blue,apronX+right.x*72,23,apronZ-forward.z*40,rot);
 hangar.castShadow=true;
 const lightsGeo=geo(new THREE.SphereGeometry(.8,6,4));
 const runwayLights=make(lightsGeo,emissive,root,'Aurora_Runway_Lights');
 // Night lights share geometry/material, but are few enough to retain independent glow.
 for(let d=-550;d<=550;d+=70)for(let s of [-1,1]){
  const l=make(lightsGeo,emissive,root);
  l.position.set(a.x+forward.x*d+right.x*19*s,16.1,a.z+forward.z*d+right.z*19*s);
 }
 runwayLights.visible=false;
 // Signature stone viaduct physically joins the two island shorelines.
 const bridgeZ=-650,bridgeY=35;
 box(root,840,8,25,stone,2460,bridgeY,bridgeZ).name='Ponte_dos_Arcos';
 for(const x of [2110,2285,2460,2635,2810]){
  const seafloor=sampleAuroraHeight(x,bridgeZ);
  box(root,19,(bridgeY-4)-Math.max(-15,seafloor),23,rock,x,(bridgeY-4+Math.max(-15,seafloor))/2,bridgeZ);
 }
 for(let s of [-1,1])box(root,840,3,2,stone,2460,bridgeY+5,bridgeZ+s*11);
 // Four exposed semicircular stone voussoirs read as arches from sea level.
 const archGeo=geo(new THREE.TorusGeometry(80,5,6,20,Math.PI));
 for(const mid of [2197.5,2372.5,2547.5,2722.5])for(const face of [-1,1]){
  const arch=make(archGeo,stone,root,'Ponte_Arco');
  arch.position.set(mid,-45,bridgeZ+face*13);
 }
 // Hand-built lighthouse with layered masonry and a glass lantern.
 const lighthouseX=4280,lighthouseZ=-650,lighthouseY=sampleAuroraHeight(lighthouseX,lighthouseZ);
 const tower=new THREE.Group();tower.position.set(lighthouseX,lighthouseY,lighthouseZ);tower.name='Farol_do_Leste';root.add(tower);
 for(let i=0;i<6;i++){
  const ring=make(geo(new THREE.CylinderGeometry(5.5-i*.31,5.9-i*.31,8,12)),i%2?red:white,tower);
  ring.position.y=4+i*8;ring.castShadow=true;
 }
 const balcony=make(geo(new THREE.CylinderGeometry(5.9,5.9,2,16)),stone,tower);balcony.position.y=50;
 const lantern=make(geo(new THREE.CylinderGeometry(4.3,4.3,8,12)),glass,tower);lantern.position.y=55;
 const glow=make(geo(new THREE.SphereGeometry(2.5,10,8)),emissive,tower);glow.position.y=55;
 const cap=make(geo(new THREE.ConeGeometry(6.4,5,12)),roofAlt,tower);cap.position.y=61;
 const beacon=new THREE.PointLight(0xffeab3,2,700);beacon.position.set(lighthouseX,lighthouseY+55,lighthouseZ);root.add(beacon);
 // Rock needles frame the coast; flora is batched with instancing.
 const random=randSeed(120903),trunkGeo=geo(new THREE.CylinderGeometry(.65,.95,1,5));
 const crownGeo=geo(new THREE.ConeGeometry(1,1,6));
 const trees=mobile?270:compatibility?130:580;
 const trunks=new THREE.InstancedMesh(trunkGeo,wood,trees),crowns=new THREE.InstancedMesh(crownGeo,leaf,trees);
 const transform=new THREE.Object3D();let placed=0;
 for(let i=0;i<trees*7&&placed<trees;i++){
  const x=(random()-.5)*11800,z=(random()-.5)*9800;
  const h=sampleAuroraHeight(x,z);
  if(h<15||h>185||Math.abs(x-a.x)<240&&Math.abs(z-a.z)<800||
   Math.hypot(x+950,z-860)<270||Math.hypot(x-lighthouseX,z-lighthouseZ)<55)continue;
  const height=10+random()*21,width=3+random()*3;
  transform.position.set(x,h+height*.22,z);transform.scale.set(width*.18,height*.43,width*.18);
  transform.rotation.set(0,random()*Math.PI*2,0);transform.updateMatrix();trunks.setMatrixAt(placed,transform.matrix);
  transform.position.y=h+height*.66;transform.scale.set(width,height*.78,width);
  transform.updateMatrix();crowns.setMatrixAt(placed,transform.matrix);placed++;
 }
 trunks.count=crowns.count=placed;trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;
 root.add(trunks,crowns);
 const rockGeo=geo(new THREE.IcosahedronGeometry(1,0));
 for(let i=0;i<(mobile?35:65);i++){
  const x=(random()-.5)*11700,z=(random()-.5)*9900,h=sampleAuroraHeight(x,z);
  if(h<-.5||h>230)continue;
  const b=make(rockGeo,rock,root);b.position.set(x,h+1,z);
  b.scale.set(3+random()*8,3+random()*13,3+random()*7);b.rotation.y=random()*6;
 }
 const cloudMat=std(0xe7f0ed,{transparent:true,opacity:.72,depthWrite:false});
 const cloudGeo=geo(new THREE.SphereGeometry(1,8,6));
 const cloudCount=compatibility?8:mobile?13:21;
 const clouds=new THREE.InstancedMesh(cloudGeo,cloudMat,cloudCount);
 for(let i=0;i<cloudCount;i++){
  const angle=i*2.39996,r=1200+Math.sqrt(i/cloudCount)*5500;
  transform.position.set(Math.cos(angle)*r,850+(i*223)%1000,Math.sin(angle)*r);
  transform.scale.set(175+(i*43)%155,28+(i*7)%35,90+(i*31)%95);
  transform.rotation.set(0,angle,0);transform.updateMatrix();clouds.setMatrixAt(i,transform.matrix);
 }
 clouds.instanceMatrix.needsUpdate=true;clouds.frustumCulled=false;root.add(clouds);
 const sun=new THREE.DirectionalLight(0xffddab,1.7);sun.position.set(-3300,8300,-2300);
 sun.target.position.set(0,0,0);scene.add(sun,sun.target);
 const hemi=new THREE.HemisphereLight(0xa7cbe1,0x486650,.9);scene.add(hemi);
 let seconds=0,active=true,status='Ilhas de Aurora · cinco ilhas · aeródromo e farol';
 function updateEnvironment(hour=15,weather='limpo',dt=0){
  if(!active)return;seconds+=Math.max(0,dt);
  const daylight=clamp(Math.sin((hour-5)/14*Math.PI),.025,1);
  sun.intensity=(weather==='nublado'?1.1:1.9)*daylight;
  hemi.intensity=.28+.72*daylight;
  cloudMat.opacity=weather==='nublado'?.96:.68;
  beacon.intensity=daylight<.25?3:0;
  emissive.color.setHex(daylight<.25?0xfff1bd:0xd8cdb0);
  renderer.toneMappingExposure=.5+.64*daylight;
 }
 function update(x,z,dt=0){if(!active)return;
  seconds+=Math.max(0,dt);
  beacon.intensity*=1;
  const d=Math.hypot(x-lighthouseX,z-lighthouseZ);
  status='Ilhas de Aurora · '+(d<900?'Farol do Leste':Math.hypot(x+950,z-860)<750?'Vila da Enseada':
   Math.hypot(x-2460,z+650)<650?'Ponte dos Arcos':'Arquipélago')+' · '+placed+' árvores';
 }
 function dispose(){if(!active)return;active=false;
  root.removeFromParent();scene.remove(sun,sun.target,hemi);
  for(const g of resources)g.dispose();for(const m of materials)m.dispose();
  // Instanced geometries above are in the same resource sets.
 }
 updateEnvironment(16,'limpo',0);
 return {root,sun,hemi,sea,cloudMat,airports:AURORA_AIRPORTS,landmarks:AURORA_LANDMARKS,
  sampleHeight:sampleAuroraHeight,updateEnvironment,update,dispose,setRealTerrainEnabled(){},
  get region(){return {id:'aurora',name:'Ilhas de Aurora'}},get status(){return status},
  get tileCount(){return active?1:0},get tileLimit(){return 1},get assetCount(){return placed},
  get uniqueAssets(){return 0},get pbrCount(){return 0}
 };
}
