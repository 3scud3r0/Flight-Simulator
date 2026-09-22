/**
 * Detailed procedural airframes. Independent GPU resources; no brand-affiliated
 * CAD or unlicensed commercial aircraft geometry. Units are metres.
 * All components use PBR materials and can later be replaced by licensed glTF.
 */
import { AIRCRAFT } from "./physics.js";
export function makeDetailedAircraft(THREE, scene, id) {
  const a = AIRCRAFT[id] || AIRCRAFT.cessna;
  const jet = id === "jet", twin = id === "twin";
  const group = new THREE.Group(), rotating = [], materials = [];
  const material = (color, metalness=.25, roughness=.48, props={}) => {
    const m = new THREE.MeshStandardMaterial({
      color, metalness, roughness, ...props
    });
    materials.push(m); return m;
  };
  const pearl = material(a.color,.38,.36);
  const trim = material(a.accent,.27,.41);
  const glass = material(0x12293d,.25,.12,{
    transparent:true,opacity:.78,envMapIntensity:1.4,side:THREE.DoubleSide
  });
  const rubber = material(0x11181d,.06,.95);
  const steel = material(0x99a6ae,.85,.25);
  const wingInner = material(0xe1e8ed,.21,.60);
  const navRed = material(0xff2433,.1,.22,{emissive:0xff1b25,emissiveIntensity:1.3});
  const navGreen = material(0x21ff7b,.1,.22,{emissive:0x20ff69,emissiveIntensity:1.3});
  const beacon = material(0xffe8d1,.1,.2,{emissive:0xffbe8a,emissiveIntensity:1.15});
  const add = (geo,mat,x=0,y=0,z=0,parent=group) => {
    const m = new THREE.Mesh(geo,mat);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);
    return m;
  };
  const sph = (sx,sy,sz,mat,x,y,z) => {
    const m=add(new THREE.SphereGeometry(1,22,14),mat,x,y,z);
    m.scale.set(sx,sy,sz);return m;
  };
  const len=a.length, span=a.wingspan;
  const diameter=jet?2.0:twin?1.12:.48;
  sph(diameter,diameter*.91,len*.45,pearl,0,0,0);
  sph(diameter*.85,diameter*.62,len*.22,pearl,0,0,-len*.29);
  sph(diameter*.43,diameter*.53,len*.22,pearl,0,0,len*.39);
  sph(diameter*.82,diameter*.36,len*.13,glass,0,diameter*.71,-len*.27);
  const sideCount=jet?8:twin?5:3;
  for(let side of [-1,1]){
    for(let i=0;i<sideCount;i++){
      const window=sph(.07*diameter,.20*diameter,.14*diameter,glass,
        side*diameter*.90,diameter*.24,-len*.12+i*len*.064);
      window.rotation.z=side*.11;
    }
    // Wing-tip position, high wing on light aircraft.
    const tip=add(new THREE.SphereGeometry(1,10,8),
      side<0?navRed:navGreen,side*span*.50,.03,0);
    tip.scale.set(.20,.13,.25);
  }
  function wingMesh(halfSpan,rootChord,tipChord,sweep,thickness,dihedral,mat,
    x0=0,y0=0,z0=0) {
    // Closed spanwise airfoil: upper/lower cambered surfaces and tapered tips.
    const verts=[],indices=[],uv=[];
    const stations=13, chordSteps=9;
    for(let side of [-1,1]){
      const base=verts.length/3;
      for(let n=0;n<=stations;n++){
        const t=n/stations;
        const chord=rootChord+(tipChord-rootChord)*t;
        const zLeading=z0-rootChord*.38+sweep*t;
        const x=x0+side*(halfSpan*t);
        const y=y0+dihedral*t;
        for(let surface of [1,-1]){
          for(let c=0;c<=chordSteps;c++){
            const u=c/chordSteps;
            const profile=Math.sin(Math.PI*u) *
              (1-.35*t)*thickness*(surface===1?.63:-.37);
            verts.push(x,y+profile,zLeading+chord*u);
            uv.push(u,t);
          }
        }
      }
      const row=(chordSteps+1)*2;
      for(let n=0;n<stations;n++)for(let surface=0;surface<2;surface++){
        for(let c=0;c<chordSteps;c++){
          const i=base+n*row+surface*(chordSteps+1)+c;
          const j=i+row;
          indices.push(i,j,i+1,i+1,j,j+1);
        }
      }
      // Section tips close volume visually.
      const k=base+stations*row;
      for(let c=0;c<chordSteps;c++){
        indices.push(k+c,k+chordSteps+1+c,k+c+1,
          k+c+1,k+chordSteps+1+c,k+chordSteps+2+c);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",
      new THREE.Float32BufferAttribute(verts,3));
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return add(geometry,mat);
  }
  wingMesh(span*.50,jet?5.7:twin?3.8:1.75,jet?1.35:twin?1.0:.75,
    jet?3.7:twin?1.55:.36,jet?.52:.21,.45,pearl,0,
    jet?-.1:twin?.55:.40,.30);
  wingMesh(span*.165,jet?2.9:twin?2.3:1.13,.58,.45,.10,.25,
    pearl,0,.38,len*.37);
  const fin=add(new THREE.BoxGeometry(.18,
    jet?4.4:twin?2.9:1.4,jet?2.1:twin?1.55:.89),
    trim,0,jet?2.2:twin?1.5:.68,len*.405);
  fin.rotation.x=-.27;
  const moving=[];
  for(let side of [-1,1]){
    const aileron=add(new THREE.BoxGeometry(span*.135,.11,
      jet?1.05:twin?.60:.32),trim,
      side*span*.38,jet?0:.52:.36,jet?2.1:twin?1.1:.67);
    moving.push(aileron);
    const elevator=add(new THREE.BoxGeometry(span*.13,.10,
      jet?.55:twin?.40:.22),wingInner,
      side*span*.12,.39,len*.43);
    moving.push(elevator);
  }
  const rudder=add(new THREE.BoxGeometry(.19,
    jet?2.1:twin?1.3:.66,.31),trim,0,
    jet?3.2:twin?2.2:1.0,len*.45);
  moving.push(rudder);
  if(jet){
    for(let side of [-1,1]){
      sph(.91,.86,2.1,steel,side*span*.265,-1.48,.7);
      const inlet=add(new THREE.TorusGeometry(.77,.14,8,28),
        steel,side*span*.265,-1.48,-1.45);
      const black=add(new THREE.CircleGeometry(.72,24),
        rubber,side*span*.265,-1.48,-1.48);
      black.rotation.y=Math.PI;
    }
  }else{
    const offsets=twin?[-span*.265,span*.265]:[0];
    for(const x of offsets){
      if(twin)sph(.60,.53,1.22,pearl,x,-.15,-1.1);
      const hub=add(new THREE.SphereGeometry(.24,12,8),
        steel,x,0,twin?-2.39:-len*.51);
      const rotor=new THREE.Group();
      rotor.position.copy(hub.position);
      for(let i=0;i<(twin?4:2);i++){
        const blade=add(new THREE.BoxGeometry(
          twin?.17:.14,twin?1.42:1.20,.09),rubber,0,
          twin?.62:.55,0,rotor);
        blade.rotation.z=i*Math.PI/(twin?2:1);
        const blade2=add(new THREE.BoxGeometry(
          twin?.17:.14,twin?1.42:1.20,.09),rubber,0,
          -(twin?.62:.55),0,rotor);
        blade2.rotation.z=i*Math.PI/(twin?2:1);
      }
      group.add(rotor);rotating.push(rotor);
    }
  }
  const gear=new THREE.Group();
  group.add(gear);
  for(const [x,z,r] of [
    [-span*.11,jet?2:twin?1.5:1.2,jet?.55:twin?.37:.24],
    [span*.11,jet?2:twin?1.5:1.2,jet?.55:twin?.37:.24],
    [0,-len*.29,jet?.41:twin?.29:.18]
  ]){
    add(new THREE.CylinderGeometry(.065,.065,
      (jet?2:twin?1.45:1.1),10),
      steel,x,-(jet?1:twin?.80:.59),z,gear);
    const wheel=add(new THREE.CylinderGeometry(r,r,r*.44,20),
      rubber,x,-(jet?2.12:twin?1.45:1.08),z,gear);
    wheel.rotation.z=Math.PI/2;
  }
  // Cabins are geometric, non-functional; navigation lights are independent.
  scene.add(group);
  return {
    group,gear,rotating,moving,
    animate(dt,state){
      for(const r of rotating)r.rotation.z+=dt*(18+state.throttle*60);
      gear.visible=state.gear;
      for(let i=0;i<2;i++)moving[i].rotation.x=
        -(state.aileronAngle||0)*(i===0?1:-1)*.19;
      for(let i=2;i<4;i++)moving[i].rotation.x=
        (state.elevatorAngle||0)*.22;
      rudder.rotation.y=(state.rudderAngle||0)*.24;
    },
    dispose(){
      scene.remove(group);
      const geos=new Set();
      group.traverse(object=>{
        if(object.isMesh)geos.add(object.geometry);
      });
      for(const g of geos)g.dispose();
      for(const m of materials)m.dispose();
    }
  };
}
