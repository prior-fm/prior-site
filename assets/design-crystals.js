import * as THREE from './vendor/three/three.module.min.js';

// Prior's proposal sculpture: one scene, three arrangements, and a seek-safe
// render contract. The page owns when to call this module; there is no ticker.
const PALETTE = {
  paper: 0xf1ecdf,
  glass: 0xb0cbd6,
  edge: 0xda9062,
  ink: 0x0a0a0a,
  clay: 0xda9062,
};
const DIRECTIONS = new Set(['a', 'b', 'c']);

function makeGlass() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(PALETTE.glass).lerp(new THREE.Color(0xffffff), .72),
    metalness: 0,
    roughness: 0.085,
    transmission: 1,
    thickness: 0.85,
    ior: 1.46,
    attenuationColor: new THREE.Color(PALETTE.glass),
    attenuationDistance: 2.8,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.4,
    transparent: false,
    opacity: 1,
    side: THREE.FrontSide,
  });
}

function makeFacet(material, radius, depth, sides = 6) {
  // A closed, cut crystal rather than overlapping transparent primitives.
  const rings = [[.64, .4], [.24, 1], [.05, 1.02], [-.42, .56], [-.64, .12]];
  const vertices = [];
  const ring = (j, i) => {
    const angle = i / sides * Math.PI * 2;
    return [Math.cos(angle) * radius * rings[j][1], depth * rings[j][0], Math.sin(angle) * radius * rings[j][1]];
  };
  const triangle = (a, b, c) => vertices.push(...a, ...b, ...c);
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < sides; i++) {
    const a = ring(j, i), b = ring(j, i + 1), c = ring(j + 1, i), d = ring(j + 1, i + 1);
    triangle(a, b, c); triangle(b, d, c);
  }
  for (let i = 0; i < sides; i++) {
    triangle([0, depth * rings[0][0], 0], ring(0, i + 1), ring(0, i));
    const last = rings.length - 1;
    triangle([0, depth * rings[last][0], 0], ring(last, i), ring(last, i + 1));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const crystal = new THREE.Mesh(geometry, material);
  crystal.rotation.set(.14, .4, 0);
  crystal.castShadow = true;
  return crystal;
}

function makeRibbon(material, points, width = 0.22, tubular = 0.12) {
  const curve = new THREE.CatmullRomCurve3(points);
  const profile = new THREE.Shape();
  // A softly rounded rectangular cross-section makes a solid glass ribbon.
  const w = width * .5, h = tubular * .5, r = h * .65;
  profile.moveTo(-w + r, -h);
  profile.lineTo(w - r, -h); profile.quadraticCurveTo(w, -h, w, -h + r);
  profile.lineTo(w, h - r); profile.quadraticCurveTo(w, h, w - r, h);
  profile.lineTo(-w + r, h); profile.quadraticCurveTo(-w, h, -w, h - r);
  profile.lineTo(-w, -h + r); profile.quadraticCurveTo(-w, -h, -w + r, -h);
  const geometry = new THREE.ExtrudeGeometry(profile, { extrudePath: curve, steps: 64, curveSegments: 4, bevelEnabled: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeLine(material, a, b, thickness = 0.018) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, direction.length(), 6), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createAtlas(material, detailMaterial) {
  const group = new THREE.Group();
  group.name = 'crystal-atlas';
  const pieces = [
    { p: [-0.54, -.12, .05], r: 0.4, d: 1.25, z: -.3 },
    { p: [0, .18, -.12], r: 0.46, d: 1.5, z: .08 },
    { p: [.57, -.17, .12], r: 0.38, d: 1.16, z: .3 },
  ];
  pieces.forEach((item, index) => {
    const mesh = makeFacet(material, item.r, item.d, index % 2 ? 5 : 6);
    mesh.position.set(item.p[0], item.p[1], item.p[2]);
    mesh.rotation.z = item.z;
    mesh.userData.base = mesh.position.clone();
    mesh.userData.baseRot = mesh.rotation.z;
    mesh.userData.index = index;
    group.add(mesh);
  });
  group.userData.parts = group.children.filter((child) => child.userData.index !== undefined);
  return group;
}

function createCurrent(material) {
  const group = new THREE.Group();
  group.name = 'glass-current';
  const paths = [
    [new THREE.Vector3(-1.25, -0.28, -0.18), new THREE.Vector3(-0.6, 0.62, 0), new THREE.Vector3(0.12, 0.1, 0.1), new THREE.Vector3(0.88, 0.64, 0.04), new THREE.Vector3(1.28, -0.25, 0.2)],
    [new THREE.Vector3(-1.08, 0.12, 0.18), new THREE.Vector3(-0.38, -0.5, 0.08), new THREE.Vector3(0.32, 0.24, -0.08), new THREE.Vector3(1.1, -0.42, -0.06)],
    [new THREE.Vector3(-0.92, -0.48, 0.08), new THREE.Vector3(-0.2, -0.08, 0.16), new THREE.Vector3(0.48, -0.62, 0.1), new THREE.Vector3(1.16, 0.08, -0.02)],
  ];
  paths.forEach((points, index) => {
    const ribbon = makeRibbon(material, points, index ? 0.3 : 0.38, index ? 0.1 : 0.14);
    ribbon.userData.index = index;
    ribbon.userData.base = ribbon.position.clone();
    ribbon.userData.baseRot = 0;
    group.add(ribbon);
  });
  group.userData.parts = group.children;
  return group;
}

function createConstellation(material, detailMaterial) {
  const group = new THREE.Group();
  group.name = 'crystal-constellation';
  const points = [
    new THREE.Vector3(-0.95, 0.42, 0), new THREE.Vector3(-0.28, 0.68, 0.16),
    new THREE.Vector3(0.44, 0.45, -0.08), new THREE.Vector3(0.94, 0.1, 0.12),
    new THREE.Vector3(-0.7, -0.32, 0.2), new THREE.Vector3(0, -0.2, -0.14),
    new THREE.Vector3(0.68, -0.48, 0.04),
  ];
  points.forEach((point, index) => {
    const crystal = makeFacet(material, index % 3 === 0 ? 0.23 : 0.18, .48, index % 2 ? 5 : 6);
    crystal.position.copy(point);
    crystal.rotation.z = index * 0.41;
    crystal.userData.base = point.clone();
    crystal.userData.index = index;
    group.add(crystal);
  });
  group.userData.connectors = [];
  [[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 5], [3, 6], [4, 5], [5, 6]].forEach(([a, b]) => { const line = makeLine(detailMaterial, points[a], points[b], .009); line.userData.ends = [a, b]; line.userData.originalLength = points[a].distanceTo(points[b]); group.userData.connectors.push(line); group.add(line); });
  group.userData.parts = group.children.filter((child) => child.userData.index !== undefined);
  return group;
}

function studioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new THREE.Scene();
  environment.background = new THREE.Color(0x101417);
  const room = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x242b2f, side: THREE.BackSide }));
  environment.add(room);
  const softboxes = [
    [0xfff4e4, [0, 3.2, 1.8], [3.8, 0.08, 0.35]],
    [0xe8f6ff, [-3.1, 0.8, 0.5], [0.08, 2.8, 0.3]],
    [0xffd8c2, [2.8, -1.2, 1.6], [0.08, 1.9, 0.24]],
  ];
  softboxes.forEach(([color, position, scale]) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.04), new THREE.MeshBasicMaterial({ color }));
    panel.position.set(...position); panel.scale.set(...scale); panel.lookAt(0, 0, 0); environment.add(panel);
  });
  const target = pmrem.fromScene(environment, 0.04).texture;
  environment.traverse((object) => { if (object.geometry) object.geometry.dispose(); if (object.material) object.material.dispose(); });
  pmrem.dispose();
  return target;
}

export function createCrystalScene(mount, { atlasOnly = false } = {}) {
  if (!mount || typeof mount.appendChild !== 'function') throw new TypeError('mount must be an HTMLElement');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (error) { throw new Error('Crystal scene requires WebGL', { cause: error }); }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.paper);
  scene.environment = studioEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
  camera.position.set(0, 0.12, 5.2);
  camera.lookAt(0, 0, 0);
  const key = new THREE.DirectionalLight(0xfff4df, 3.3); key.position.set(-3, 4, 5); key.castShadow = true; scene.add(key);
  const fill = new THREE.DirectionalLight(0xa5d7e9, 1.8); fill.position.set(4, 0.5, 3); scene.add(fill);
  const rim = new THREE.PointLight(0xc98368, 2.2, 9); rim.position.set(-2, -2, 2); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ color: PALETTE.ink, opacity: .12 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.3; floor.receiveShadow = true; scene.add(floor);
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = .02;
  const material = makeGlass();
  const detailMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.clay, roughness: 0.46, metalness: 0.05 });
  const groups = { a: createAtlas(material, detailMaterial) };
  if (!atlasOnly) Object.assign(groups, { b: createCurrent(material), c: createConstellation(material, detailMaterial) });
  Object.entries(groups).forEach(([direction, group]) => { group.visible = direction === 'a'; scene.add(group); });
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true'); canvas.style.display = 'block'; mount.appendChild(canvas);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  let direction = 'a'; let progress = 0; let selection = -1; let destroyed = false; let framePending = 0;
  const smooth = value => { value = THREE.MathUtils.clamp(value, 0, 1); return value * value * (3 - 2 * value); };
  function render() { framePending = 0; if (!destroyed) renderer.render(scene, camera); }
  function scheduleRender() { if (destroyed || framePending) return; framePending = window.requestAnimationFrame(render); }
  function apply() {
    const group = groups[direction];
    Object.values(groups).forEach((candidate) => { candidate.visible = candidate === group; });
    group.userData.parts.forEach((part, index) => {
      const base = part.userData.base || new THREE.Vector3();
      const open = smooth(progress / .45);
      const resolve = smooth((progress - .62) / .38);
      const lift = selection === index ? .18 : 0;
      if (direction === 'a') {
        part.position.set(THREE.MathUtils.lerp(base.x * (1 + open * .9), (index - 1) * 1.02, resolve), THREE.MathUtils.lerp(base.y + (index === 1 ? .18 : -.12) * open, 0, resolve) + lift, THREE.MathUtils.lerp(base.z + (index - 1) * open * .12, 0, resolve));
        part.rotation.z = THREE.MathUtils.lerp((part.userData.baseRot || 0) * (1 + open), 0, resolve);
        part.rotation.y = .4 + open * .35 - resolve * .22;
      } else if (direction === 'b') {
        part.position.set((index - 1) * open * .06, (index - 1) * open * .34 + lift, (index - 1) * open * .12);
        part.rotation.set(resolve * .18, open * (index - 1) * .25, (index - 1) * open * .08);
      } else {
        part.position.set(THREE.MathUtils.lerp(base.x * (1 + open * .3), ((index % 3) - 1) * .95, resolve), THREE.MathUtils.lerp(base.y * (1 + open * .18), (1 - Math.floor(index / 3)) * .62 - .25, resolve) + (selection === index % 3 ? .1 : 0), base.z * (1 - resolve));
        part.rotation.z = (part.userData.baseRot || index * .41) * (1 - resolve);
      }
      part.scale.setScalar(selection === index || direction === 'c' && selection === index % 3 ? 1.07 : 1);
    });
    if (group.userData.connectors) group.userData.connectors.forEach(line => {
      const [a, b] = line.userData.ends.map(index => group.userData.parts[index].position);
      const vector = new THREE.Vector3().subVectors(b, a);
      line.position.copy(a).add(b).multiplyScalar(.5);
      line.scale.y = vector.length() / line.userData.originalLength;
      line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
    });
    camera.rotation.z = (progress - 0.5) * 0.035;
    scheduleRender();
  }
  function resize(nextMount = mount) {
    mount = nextMount;
    const width = Math.max(1, mount.clientWidth); const height = Math.max(1, mount.clientHeight);
    camera.aspect = width / height;
    // Full animated width is about 3.4 world units; fit it on narrow 300px mounts.
    camera.position.z = Math.max(6.2, 3.8 / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * camera.aspect));
    camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(width, height, false); scheduleRender();
  }
  function setDirection(next) { if (!DIRECTIONS.has(next) || !groups[next]) throw new RangeError('direction is not available in this scene'); direction = next; apply(); }
  function setProgress(next) { if (typeof next !== 'number' || !Number.isFinite(next)) throw new TypeError('progress must be finite'); progress = THREE.MathUtils.clamp(next, 0, 1); apply(); }
  function setSelection(next) { if (next !== null && next !== -1 && (!Number.isInteger(next) || next < 0)) throw new RangeError('selection must be a non-negative integer or -1'); selection = next === null ? -1 : next; apply(); }
  function destroy() { if (destroyed) return; destroyed = true; if (framePending) window.cancelAnimationFrame(framePending); canvas.remove(); Object.values(groups).forEach((group) => group.traverse((object) => { if (object.geometry) object.geometry.dispose(); })); material.dispose(); detailMaterial.dispose(); floor.geometry.dispose(); floor.material.dispose(); scene.environment.dispose(); renderer.dispose(); }
  resize();
  return { setDirection, setProgress, setSelection, resize, destroy };
}
