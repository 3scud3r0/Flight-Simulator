/**
 * Ocean shader: GPU Gerstner-inspired multi-frequency waves, view-angle
 * Fresnel reflection, sun glint and cloud/horizon tint. No external assets.
 * A visual renderer only; not a hydrodynamic simulator.
 */
export function createOcean(THREE, scene, renderer, extent = 63000) {
  const uniforms = {
    uTime:{value:0},uWind:{value:1},
    uSun:{value:new THREE.Vector3(.3,.8,-.4).normalize()},
    uDay:{value:1}
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    depthWrite:true,
    vertexShader:`
      uniform float uTime;
      uniform float uWind;
      varying vec3 vWorld;
      varying float vWave;
      float wave(vec2 p,vec2 dir,float freq,float speed,float amp) {
        return sin(dot(p,dir)*freq+uTime*speed)*amp;
      }
      void main() {
        vec3 p=position;
        vec2 pos=position.xy;
        float w =
          wave(pos,vec2(.83,.56),.0064,.65,1.05)+
          wave(pos,vec2(-.38,.91),.0125,1.1,.48)+
          wave(pos,vec2(.65,-.76),.0370,1.8,.16);
        p.z+=w*uWind;
        vWave=w;
        vec4 world=modelMatrix*vec4(p,1.);
        vWorld=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }
    `,
    fragmentShader:`
      precision highp float;
      uniform vec3 uSun;
      uniform float uDay;
      uniform float uWind;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
        if(n.y<0.)n=-n;
        vec3 view=normalize(cameraPosition-vWorld);
        float fresnel=pow(1.0-max(0.0,dot(n,view)),5.0);
        float shallow=clamp((vWave+.6)*.15,0.,1.);
        vec3 deep=mix(vec3(.004,.025,.046),vec3(.007,.098,.145),uDay);
        vec3 turquoise=vec3(.018,.18,.22)*uDay;
        vec3 water=mix(deep,turquoise,shallow*.25);
        vec3 reflectedSky=mix(vec3(.025,.04,.08),vec3(.30,.55,.69),uDay);
        water=mix(water,reflectedSky,fresnel*.63);
        vec3 reflected=reflect(-normalize(uSun),n);
        float sunGlint=pow(max(0.,dot(reflected,view)),125.0);
        water+=vec3(1.,.83,.52)*sunGlint*uDay*.83;
        float glimmer=pow(max(0.,dot(reflected,view)),17.0)*.085*uWind;
        water+=vec3(.37,.67,.76)*glimmer;
        gl_FragColor=vec4(water,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const geometry = new THREE.PlaneGeometry(extent,extent,
    Math.min(96,renderer.capabilities.maxTextures?96:64),
    Math.min(96,renderer.capabilities.maxTextures?96:64));
  const surface = new THREE.Mesh(geometry,material);
  surface.rotation.x=-Math.PI/2;
  surface.position.y=-.75;
  surface.receiveShadow=false;
  surface.frustumCulled=false;
  scene.add(surface);
  return {
    surface,
    update(dt,sun,weather){
      uniforms.uTime.value+=Math.max(0,dt);
      uniforms.uWind.value=weather==="vento"?2.1:
        weather==="chuva"?1.45:.9;
      uniforms.uSun.value.set(sun.x,sun.y,sun.z).normalize();
      uniforms.uDay.value=Math.max(.08,Math.min(1,(sun.y+.10)*2));
    },
    dispose(){scene.remove(surface);geometry.dispose();material.dispose()}
  };
}
