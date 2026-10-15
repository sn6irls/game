import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { measureBowlRim } from "./bowl-fit.js";

function machinePivot(machine, name, meshName, position) {
  const existing = machine.getObjectByName(name);
  if (existing) return existing;
  const part = machine.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(meshName));
  if (!part) throw new Error(`Missing machine part: ${meshName}`);
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.fromArray(position);
  machine.add(pivot);
  machine.updateMatrixWorld(true);
  // Keep the new GLB's vertices, UVs and authored pose untouched.
  pivot.attach(part);
  return pivot;
}

function addLidLining(lid) {
  // The exported cap's underside is a flat, uniformly green atlas patch.
  // A shallow inset distinguishes the inside of the lid from the hopper opening.
  const cap = lid.getObjectByName("normal_hair003");
  if (!cap?.isMesh) return;
  const source = cap.geometry;
  const positions = source.getAttribute("position"), index = source.index;
  const underside = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (let i = 0; i < (index ? index.count : positions.count); i += 3) {
    a.fromBufferAttribute(positions, index ? index.getX(i) : i);
    b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2);
    if (ab.subVectors(b, a).cross(ac.subVectors(c, a)).normalize().y > -0.98) continue;
    underside.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  }
  if (!underside.length) return;
  const geometry = new THREE.BufferGeometry();
  const inset = new THREE.Float32BufferAttribute(underside, 3);
  geometry.setAttribute("position", inset);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  for (let i = 0; i < inset.count; i++) {
    inset.setXYZ(i,
      center.x + (inset.getX(i) - center.x) * 0.88,
      inset.getY(i) - 0.005,
      center.z + (inset.getZ(i) - center.z) * 0.88);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const lining = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: "#b0ce94", roughness: 0.92, metalness: 0, flatShading: true,
  }));
  lining.name = "LidLining";
  cap.add(lining);
}

function createEyeBlink(face) {
  // bingsugirl.png has open/closed faces in adjacent 256px atlas cells.
  // Isolate the face's texture transform from the hair and other shared parts.
  face.material = face.material.clone();
  const map = face.material.map.clone();
  face.material.map = map;
  map.needsUpdate = true;
  const openOffset = map.offset.x;
  let closed = false;
  let remaining = 1.5 + Math.random() * 2;
  return (dt) => {
    remaining -= dt;
    if (remaining > 0) return;
    closed = !closed;
    map.offset.x = openOffset + (closed ? 1 / 6 : 0);
    remaining = closed ? 0.11 + Math.random() * 0.05 : 2.8 + Math.random() * 3;
  };
}

function createBottleSqueeze(body) {
  // Deform a runtime copy; keep the artist's file, UVs, cap and nozzle intact.
  const geometry = body.geometry.clone();
  body.geometry = geometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const center = bounds.getCenter(new THREE.Vector3());
  const height = bounds.max.y - bounds.min.y;
  const position = geometry.getAttribute("position");
  position.setUsage(THREE.DynamicDrawUsage);
  const rest = Float32Array.from(position.array);
  const weights = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const y = (position.getY(i) - bounds.min.y) / height;
    // Press a broad band evenly, easing off only near the shoulder and base.
    weights[i] = THREE.MathUtils.smoothstep(y, 0.04, 0.22) *
      (1 - THREE.MathUtils.smoothstep(y, 0.78, 0.96));
  }
  let previous = -1;
  return (amount) => {
    amount = THREE.MathUtils.clamp(amount, 0, 1);
    if (amount < 0.001) amount = 0;
    if (amount > 0.999) amount = 1;
    if (amount === previous) return;
    previous = amount;
    for (let i = 0; i < position.count; i++) {
      // Flatten the flexible body sideways with a little depth expansion.
      const pressure = weights[i] * amount;
      position.setXYZ(
        i,
        center.x + (rest[i * 3] - center.x) * (1 - pressure * 0.3),
        rest[i * 3 + 1],
        center.z + (rest[i * 3 + 2] - center.z) * (1 + pressure * 0.05),
      );
    }
    position.needsUpdate = true;
  };
}

export async function loadModels() {
  const loader = new GLTFLoader();
  const urls = ["bingsu-machine", "kimchi", "baekkimchi", "bowl", "sauce1", "sauce2", "desk", "plane"];
  const loaded = await Promise.all(
    urls.map((name) =>
      loader.loadAsync(
        new URL(`../assets/models/${name}.glb?v=20261015-mobile`, import.meta.url).href,
      ),
    ),
  );
  const machine = loaded[0].scene;
  const lid = machinePivot(machine, "Lid", "normal_hair.003", [0, 0.739, -0.40]);
  addLidLining(lid);
  const crank = machinePivot(machine, "Crank", "normal_hair.002", [0.36, 0.515, -0.14]);
  const tail = machinePivot(machine, "LeftTail", "normal_hair.001", [-0.36, 0.515, -0.14]);
  for (const [original, name] of [
    ["Cylinder", "MachineBody"], ["Plane", "Glasses"],
    ["face", "Face"], ["normal_hair", "Hair"],
  ]) {
    const part = machine.getObjectByName(original);
    if (part) part.name = name;
  }
  const face = machine.getObjectByName("Face");
  if (!face?.material.map)
    throw new Error("The machine model is missing a moving part.");
  const updateBlink = createEyeBlink(face);
  const modelScale = 4.8;
  // Older exports may include a bowl; the current artist export uses bowl.glb.
  (machine.getObjectByName("Bowl") || machine.getObjectByName("Cylinder001"))?.removeFromParent();
  machine.scale.setScalar(modelScale);
  machine.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    // The hand-painted character already includes shading. Thin hair surfaces
    // must not shadow themselves; they still cast shadows onto the room.
    object.receiveShadow = object.name === "MachineBody";
    const materials = Array.isArray(object.material)
      ? object.material : [object.material];
    for (const material of materials) {
      // Keep the authored unlit shading and UV set. Hair gradients use the
      // source Blender material's Linear filter, without adding realtime highlights.
      if (material.map && (object.name === "Hair" || object.name.startsWith("normal_hair"))) {
        material.map.magFilter = THREE.LinearFilter;
        material.map.minFilter = THREE.LinearMipmapLinearFilter;
        material.map.needsUpdate = true;
      }
    }
  });

  // The separate bowl export is floor-normalized; seat it as in bingsu.blend.
  const bowl = loaded[3].scene;
  const bowlBounds = new THREE.Box3().setFromObject(bowl);
  const bowlSize = bowlBounds.getSize(new THREE.Vector3());
  const bowlCenter = bowlBounds.getCenter(new THREE.Vector3());
  const bowlScale = modelScale;
  const bowlHome = new THREE.Vector3(
    bowlCenter.x * modelScale,
    0.0573323071 * modelScale,
    bowlCenter.z * modelScale,
  );
  bowl.position.set(
    -bowlCenter.x * bowlScale,
    -bowlBounds.min.y * bowlScale,
    -bowlCenter.z * bowlScale,
  );
  bowl.scale.setScalar(bowlScale);
  bowl.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    // Preserve the GLB's painted petals and unlit material instead of recoloring it.
    object.receiveShadow = false;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (material.map) {
        material.map.magFilter = THREE.NearestFilter;
        material.map.needsUpdate = true;
      }
    }
  });

  const foods = loaded.slice(1, 3).map((gltf) => {
    const root = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = modelScale;
    const wrapper = new THREE.Group();
    root.scale.setScalar(scale);
    root.position.copy(center).multiplyScalar(-scale);
    root.position.y += size.y * scale * 0.5;
    wrapper.add(root);
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = true;
      if (object.material.map)
        object.material.map.magFilter = THREE.NearestFilter;
    });
    return wrapper;
  });
  const sauces = loaded.slice(4, 6).map((gltf) => {
    const source = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(source);
    let body, nozzleBounds, widest = 0, highest = -Infinity;
    source.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = false;
      const partBounds = new THREE.Box3().setFromObject(object);
      const width = partBounds.max.x - partBounds.min.x;
      if (width > widest) {
        widest = width;
        body = object;
      }
      if (partBounds.max.y > highest) {
        highest = partBounds.max.y;
        nozzleBounds = partBounds;
      }
    });
    // Keep the authored geometry, UVs and materials. Only move the origin to
    // the nozzle tip and turn the bottle over for the existing pouring motion.
    const tip = nozzleBounds.getCenter(new THREE.Vector3());
    tip.y = nozzleBounds.max.y;
    source.position.sub(tip);
    const root = new THREE.Group();
    root.rotation.z = Math.PI;
    root.scale.setScalar(modelScale);
    root.add(source);
    return {
      root,
      squeeze: createBottleSqueeze(body),
      height: (bounds.max.y - bounds.min.y) * modelScale,
    };
  });
  const room = new THREE.Group();
  room.name = "ArtistRoom";
  room.scale.setScalar(modelScale);
  room.add(loaded[6].scene, loaded[7].scene);
  return {
    machine,
    room,
    updateBlink,
    lid,
    crank,
    tail,
    bowl,
    foods,
    sauces,
    bowlHome,
    bowlWidth: Math.min(bowlSize.x, bowlSize.z) * modelScale,
    bowlRim: measureBowlRim(bowl, bowlSize.y * modelScale),
  };
}
