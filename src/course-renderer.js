/**
 * Procedural glowing 3D flight tunnel.
 * Three.js is injected: all gameplay/collision logic stays in challenge.js.
 */
export function createCourseVisual(THREE, scene, rings) {
  const root = new THREE.Group();
  root.name = "RioFlightChallengeTunnel";
  const forwardAxis = new THREE.Vector3(0, 0, 1);
  const colors = {
    pending: 0x4bd7ed, active: 0xffd580,
    passed: 0x55ffc2, missed: 0xff777d
  };
  const materials = Object.fromEntries(Object.entries(colors).map(
    ([key, color]) => [key, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: key === "pending" ? .73 : .99,
      toneMapped: false, depthWrite: false
    })]
  ));
  const halos = Object.fromEntries(Object.entries(colors).map(
    ([key, color]) => [key, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: key === "pending" ? .13 : .24,
      toneMapped: false, depthWrite: false, side: THREE.DoubleSide
    })]
  ));
  const geometry = new THREE.TorusGeometry(rings[0].radius, 1.45, 8, 64);
  const glowGeometry = new THREE.TorusGeometry(rings[0].radius, 6.2, 6, 64);
  const markers = [];

  for (const ring of rings) {
    const group = new THREE.Group();
    group.position.set(ring.x, ring.y, ring.z);
    group.quaternion.setFromUnitVectors(forwardAxis,
      new THREE.Vector3(ring.normal.x, ring.normal.y, ring.normal.z).normalize());
    const hoop = new THREE.Mesh(geometry, materials.pending);
    const glow = new THREE.Mesh(glowGeometry, halos.pending);
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(ring.radius - 4.0, .4, 4, 64),
      materials.pending
    );
    group.add(hoop, glow, inner);
    markers.push({ group, hoop, glow, inner });
    root.add(group);
  }

  const rails = [];
  const railMat = new THREE.MeshBasicMaterial({
    color: 0x54dcec, transparent: true, opacity: .22,
    depthWrite: false, toneMapped: false
  });
  // Offset rails trace the course. They are visual guides, not collision surfaces.
  for (const [horizontal, vertical] of [[1, 0], [-1, 0], [0, 1]]) {
    const points = rings.map(r => new THREE.Vector3(
      r.x + r.normal.z * -(r.radius + 8) * horizontal,
      r.y + (r.radius + 8) * vertical,
      r.z + r.normal.x * (r.radius + 8) * horizontal
    ));
    const curve = new THREE.CatmullRomCurve3(points);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(24, rings.length * 14), .65, 4, false),
      railMat
    );
    rails.push(rail);
    root.add(rail);
  }

  function setProgress(next, results = []) {
    markers.forEach(({ group, hoop, glow, inner }, index) => {
      let state = "pending";
      if (index === next) state = "active";
      else if (index < next) state = results[index] ? "passed" : "missed";
      hoop.material = materials[state];
      glow.material = halos[state];
      inner.material = materials[state];
      group.visible = index >= Math.max(0, next - 2);
      group.scale.setScalar(index === next ? 1.035 : 1);
    });
  }

  function dispose() {
    scene.remove(root);
    root.traverse(obj => {
      // Shared torus geometries disposed once below.
      if (obj.isMesh && obj.geometry !== geometry &&
        obj.geometry !== glowGeometry) obj.geometry.dispose();
    });
    geometry.dispose();
    glowGeometry.dispose();
    Object.values(materials).forEach(m => m.dispose());
    Object.values(halos).forEach(m => m.dispose());
    railMat.dispose();
  }

  scene.add(root);
  setProgress(0);
  return { root, setProgress, dispose };
}
