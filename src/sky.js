import { solarPosition, windAt } from "./atmosphere.js";
/**
 * Sky dome with procedural Rayleigh-like gradient, sun and moon discs,
 * stars after twilight, time-correct solar position and weather haze.
 * This is not a full multiple-scattering spectral atmosphere solver.
 */
export function createSky(THREE, scene, world, renderer, location = {
  lat: -22.93, lon: -43.21
}) {
  const uniforms = {
    uSun: { value: new THREE.Vector3(.4, .7, -.5).normalize() },
    uMoon: { value: new THREE.Vector3(-.4, -.7, .5).normalize() },
    uDay: { value: 1 },
    uCloud: { value: .2 },
    uTime: { value: 0 }
  };
  const shader = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w * 0.999999;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vDir;
      uniform vec3 uSun;
      uniform vec3 uMoon;
      uniform float uDay;
      uniform float uCloud;
      uniform float uTime;
      float hash(vec3 p){
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      void main(){
        vec3 d = normalize(vDir);
        float horizon = pow(1.0-abs(d.y), 2.4);
        float night = 1.0 - smoothstep(-0.18, 0.08, uDay);
        float sunlight = smoothstep(-0.18, 0.13, uSun.y);
        vec3 zenith = mix(vec3(.003,.009,.028),vec3(.105,.37,.79), sunlight);
        vec3 lower = mix(vec3(.014,.022,.043),vec3(.55,.73,.90), sunlight);
        vec3 sky = mix(zenith, lower, horizon);
        float dusk = exp(-pow(uSun.y/.22,2.0));
        sky += vec3(.88,.24,.075)*dusk*pow(max(0.0,dot(d,uSun)),3.0);
        float sunDot = dot(d,normalize(uSun));
        float sun = smoothstep(.99983,.99995,sunDot);
        sky += vec3(1.0,.91,.65)*sun*max(0.0, sunlight)*2.0;
        float glow = pow(max(0.0,sunDot),135.0);
        sky += vec3(1.0,.48,.20)*glow*sunlight*.45;
        float moon = smoothstep(.99990,.99996,dot(d,normalize(uMoon)));
        sky += vec3(.76,.83,1.0)*moon*night*.63;
        vec3 cell = floor(d * 720.0);
        float star = step(.997,hash(cell))*pow(hash(cell.zxy+12.1),3.0);
        sky += vec3(.72,.81,1.0)*star*night*step(.04,d.y)*1.3;
        sky = mix(sky, mix(vec3(.18,.20,.25),vec3(.56,.66,.73),sunlight),
          horizon*uCloud*.32);
        gl_FragColor = vec4(sky,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(30000, 48, 24), shader);
  dome.frustumCulled = false;
  dome.renderOrder = -900;
  scene.add(dome);
  const moon = new THREE.DirectionalLight(0x9bbdf6, 0);
  scene.add(moon);
  const navColor = new THREE.Color();
  let time = 0;
  function update(date, weather = "limpo", dt = 0, aircraft = null) {
    time += dt;
    const sun = solarPosition(date, location.lat, location.lon);
    const bright = Math.max(0, Math.sin(sun.elevationDeg * Math.PI / 180));
    const twilight = Math.max(0, Math.min(1,
      (sun.elevationDeg + 10) / 18));
    const overcast = weather === "nublado" ? .50 :
      weather === "névoa" ? .36 : weather === "chuva" ? .66 : .1;
    const dir = sun.vector;
    uniforms.uSun.value.set(dir.x, dir.y, dir.z).normalize();
    uniforms.uMoon.value.copy(uniforms.uSun.value).negate();
    uniforms.uDay.value = Math.max(-.2, dir.y);
    uniforms.uCloud.value = overcast;
    uniforms.uTime.value = time;
    world.sun.position.set(dir.x * 18000, dir.y * 18000, dir.z * 18000);
    world.sun.intensity = (.04 + 2.5 * bright) * (1 - overcast * .78);
    world.sun.color.setHSL(.095 - .035 * twilight, .40, .84);
    moon.position.copy(world.sun.position).negate();
    moon.intensity = .16 * (1 - twilight);
    if (scene.fog) {
      navColor.setRGB(.05 + .55 * twilight,
        .07 + .68 * twilight, .13 + .70 * twilight);
      scene.fog.color.copy(navColor);
      scene.fog.density = weather === "névoa" ? .00018 :
        weather === "chuva" ? .00011 : weather === "nublado" ? .000055 : .000019;
    }
    world.cloudMat.opacity = weather === "nublado" || weather === "chuva"
      ? .93 : .72;
    world.cloudMat.color.setHSL(.58, .08, .35 + twilight * .63);
    renderer.toneMappingExposure = .29 + twilight * .88;
    scene.background = null;
    if (aircraft) {
      dome.position.set(aircraft.x, aircraft.y, aircraft.z);
      const wind = windAt(aircraft.y, time, weather);
      return { sun, wind, visibilityMeters: scene.fog ?
        3 / Math.max(scene.fog.density, 1e-7) : 100000 };
    }
    return { sun };
  }
  function dispose() {
    scene.remove(dome); scene.remove(moon);
    dome.geometry.dispose(); shader.dispose();
  }
  return { update, dispose, dome };
}
