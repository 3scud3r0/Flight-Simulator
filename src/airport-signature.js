/**
 * Airport visual signature. Entirely original, locally-authored geometry.
 * Positions are expressed in runway coordinates: X = runway right,
 * Z = runway back, metres. No flight-physics or runway-collision changes.
 */
export function planAirportSignature(airport){
 if(!airport||!Number.isFinite(airport.heading)||
    !Number.isFinite(airport.elevation)||
    !(airport.runways?.[0]?.length>0))
  throw new TypeError("A valid Aetheria airport is required");
 const international=airport.category==="internacional";
 const tropical=airport.regionId==="auralis";
 const alpine=airport.regionId==="vertice";
 const height=international?25:alpine?13:16;
 const length=international?350:180;
 const lateral=international?630:530;
 const width=international?165:105;
 const terminal={right:lateral,back:0,width,height,length};
 const tower={right:lateral+140,back:-(length/2+150),
  width:international?23:15,height:international?72:39};
 const connections=international?[-110,0,110]:[-55,55];
 return {
  regionId:airport.regionId,terminal,tower,
  bridgeFrom:international?335:315,
  bridgeTo:lateral-width/2+6,
  connections,
  accents:international?0x56b3d2:tropical?0x4ec5bc:
   alpine?0xb3cbd2:0x70ad83
 };
}

/**
 * The caller owns geometries through the airport scene group. Materials are
 * created for this airport only and must be explicitly disposed at unload.
 */
export function createAirportSignature(THREE,parent,airport,{
 mobile=false,compatibility=false
}={}){
 if(compatibility)return {dispose(){},setDaylight(){}};
 const plan=planAirportSignature(airport);
 const surface=airport.elevation-.12;
 const angle=-airport.heading*Math.PI/180;
 const root=new THREE.Group();
 root.name="Aetheria_Signature_"+airport.id;
 root.position.set(airport.x,surface,airport.z);
 root.rotation.y=angle;
 parent.add(root);
 const materials={
  concrete:new THREE.MeshStandardMaterial({
   color:0xb5c1ca,metalness:.09,roughness:.82}),
  roof:new THREE.MeshStandardMaterial({
   color:0x526674,metalness:.34,roughness:.65}),
  glass:new THREE.MeshStandardMaterial({
   color:plan.accents,metalness:.24,roughness:.3,
   emissive:plan.accents,emissiveIntensity:.08}),
  steel:new THREE.MeshStandardMaterial({
   color:0x637986,metalness:.44,roughness:.52}),
  stripe:new THREE.MeshBasicMaterial({
   color:0xf8e7b3,toneMapped:false})
 };
 const geometries=[];
 function box(name,right,height,back,width,tall,length,mat){
  const geometry=new THREE.BoxGeometry(width,tall,length);
  geometries.push(geometry);
  const mesh=new THREE.Mesh(geometry,materials[mat]);
  mesh.name=name;
  mesh.position.set(right,height,back);
  mesh.receiveShadow=true;
  root.add(mesh);
  return mesh;
 }
 const t=plan.terminal;
 // Modular concourse: recognizable curved-terminal silhouette would need
 // authored assets; this geometric terminal improves the airport composition.
 box("terminal-main",t.right,t.height/2,0,
  t.width,t.height,t.length,"concrete");
 box("terminal-roof",t.right,t.height+.95,0,
  t.width+10,1.9,t.length+16,"roof");
 box("terminal-glass-airside",
  t.right-t.width/2-.26,t.height*.57,0,
  .55,t.height*.57,t.length-12,"glass");
 box("terminal-glass-landside",
  t.right+t.width/2+.26,t.height*.53,0,
  .55,t.height*.58,t.length-12,"glass");
 box("terminal-upper-window-band",
  t.right,t.height*.83,0,
  t.width+1,2.4,t.length-15,"glass");
 // Roof modules break up the silhouette without separate per-window meshes.
 for(const back of [-t.length*.29,0,t.length*.29])
  box("terminal-roof-vent",t.right,t.height+3.3,back,
   t.width*.38,3.2,14,"steel");
 const bridgeLength=plan.bridgeTo-plan.bridgeFrom;
 for(const back of plan.connections){
  box("passenger-bridge",plan.bridgeFrom+bridgeLength/2,8.7,back,
   bridgeLength,3.9,mobile?9:12,"glass");
  box("bridge-roof",plan.bridgeFrom+bridgeLength/2,11,back,
   bridgeLength+1,1,13,"roof");
  box("stand-line",plan.bridgeFrom-14,.48,back,
   16,.12,1,"stripe");
 }
 // Control tower is built in sections rather than as a featureless prism.
 const c=plan.tower;
 box("tower-stem",c.right,c.height*.45,c.back,
  c.width*.7,c.height*.9,c.width*.7,"concrete");
 box("tower-beacon-floor",c.right,c.height*.92,c.back,
  c.width*1.55,c.height*.13,c.width*1.55,"glass");
 box("tower-roof",c.right,c.height+.7,c.back,
  c.width*1.75,1.5,c.width*1.75,"roof");
 box("tower-beacon",c.right,c.height+3,c.back,
  1.5,4,1.5,"stripe");
 let disposed=false;
 return {
  root,plan,
  setDaylight(daylight){
   const night=Math.pow(1-Math.max(0,Math.min(1,daylight)),2);
   materials.glass.emissiveIntensity=.06+.65*night;
  },
  dispose(){
   if(disposed)return;
   disposed=true;
   root.removeFromParent();
   for(const geometry of geometries)geometry.dispose();
   for(const material of Object.values(materials))material.dispose();
  }
 };
}
