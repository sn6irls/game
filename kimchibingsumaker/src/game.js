import * as THREE from "../vendor/three/three.module.js";
import { loadModels } from "./models.js";
import { createRoom } from "./room.js";
import { createSeasoning } from "./seasoning.js";
import { Sound } from "./sound.js";
const startButton = document.getElementById("start");
startButton.disabled = true;
let models;
try {
  models = await loadModels();
} catch (error) {
  const notice = document.getElementById("error");
  notice.hidden = false;
  notice.textContent = "모델을 불러오지 못했어요. 새로고침해 주세요.";
  throw error;
}
startButton.disabled = false;
document.getElementById("pixel-prompt").textContent = "touch to start";
const $ = (id) => document.getElementById(id),
  canvas = $("world");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
} catch (e) {
  $("error").hidden = false;
  $("error").textContent =
    "3D 화면을 열 수 없어요. Chrome이나 Safari에서 다시 열어주세요.";
  throw e;
}
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Neutral sRGB output; apply any final color grading in one later pass.
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#858d8b");
const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 80);
const presentationCamera = camera.clone();
presentationCamera.layers.set(1);
let viewAspect = 1, frameHeight = 8.6, presentationHeight = 8.6;
camera.position.set(0.4, 4.5, 10);
const look = new THREE.Vector3(0, 1.9, 0),
  cameraGoal = new THREE.Vector3(),
  lookGoal = new THREE.Vector3();
scene.add(new THREE.HemisphereLight("#ffffff", "#a0a0a0", 0.9));
const moon = new THREE.DirectionalLight("#ffffff", 0.2);
moon.position.set(-5, 8, -4);
scene.add(moon);
const warm = new THREE.DirectionalLight("#ffffff", 1.1);
warm.position.set(-3, 8, 6);
warm.target.position.set(0, 1, 0);
warm.castShadow = true;
warm.shadow.mapSize.set(2048, 2048);
Object.assign(warm.shadow.camera, {
  left: -5,
  right: 5,
  top: 5,
  bottom: -5,
  near: 0.5,
  far: 20,
});
warm.shadow.camera.updateProjectionMatrix();
warm.shadow.bias = 0.00015;
warm.shadow.normalBias = 0.04;
warm.shadow.intensity = 0.16;
scene.add(warm, warm.target);
let seed = 785;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const mat = (c, rough = 0.72) =>
  new THREE.MeshStandardMaterial({
    color: c,
    roughness: rough,
    flatShading: true,
  });

function mesh(geo, material, parent = scene, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
createRoom(scene, models.room);
const { machine, lid, crank, tail, bowl, foods, sauces, bowlHome, bowlRim } = models;
scene.add(machine);
const dish = new THREE.Group();
scene.add(dish);
dish.add(bowl);
const dishHome = bowlHome;
dish.position.copy(dishHome);
dish.scale.setScalar(1);

const iceGroup = new THREE.Group();
dish.add(iceGroup);
const iceBaseHeight = 0.28;
iceGroup.position.y = iceBaseHeight;
const R = Math.min(...bowlRim.map((sample) => sample.radius)) * 1.02,
  moundRadius = R,
  shoulderHeight = Math.max(...bowlRim.map((sample) => sample.height)) - iceBaseHeight + 0.055,
  edgeHeight = Math.min(...bowlRim.map((sample) => sample.height)) - iceBaseHeight + 0.055,
  H = 1.06,
  inkDiameter = R * 2;
function iceRelief(x, z) {
  return (
    (Math.sin(x * 24 + Math.sin(z * 13)) * Math.cos(z * 29 - x * 5) * 0.014 +
      Math.sin(x * 61 + z * 49) * 0.006) *
    Math.max(0, 1 - (x * x + z * z) / (R * R))
  );
}
const surfaceY = (x, z) => {
  const distance = Math.hypot(x, z);
  const r = distance / moundRadius;
  // A circular, gently rounded cone: the bowl's petals must not shape its slopes.
  const tipRoundness = 0.1;
  const roundedR = (Math.hypot(r, tipRoundness) - tipRoundness) /
    (Math.hypot(1, tipRoundness) - tipRoundness);
  const mountain = shoulderHeight +
    (H - shoulderHeight) * Math.pow(Math.max(0, 1 - roundedR), 1.15);
  // Add most of the extra ice around the middle, keeping a softly rounded peak.
  const fullness = 0.1 * Math.sin(Math.PI * Math.min(r, 1)) ** 2;
  // Soften only the very top; keep the mountain's shoulders and volume.
  const cap = 0.025 * Math.pow(Math.max(0, 1 - (r / 0.2) ** 2), 2);
  // Round the outer shoulder down into the bowl, without tracing its petals.
  // A quarter-circle roll avoids a flat, sharply cut ledge at the boundary.
  const skirt = THREE.MathUtils.clamp((r - 0.78) / 0.22, 0, 1);
  const roll = 1 - Math.sqrt(Math.max(0, 1 - skirt * skirt));
  return (
    mountain + fullness - cap + (edgeHeight - shoulderHeight) * roll +
    iceRelief(x, z) * 1.25 * Math.max(0, 1 - r * r) *
      THREE.MathUtils.smoothstep(r, 0, 0.18)
  );
};
function surfaceNormal(x, z) {
  const e = 0.002;
  return new THREE.Vector3(
    (surfaceY(x - e, z) - surfaceY(x + e, z)) / (2 * e),
    1,
    (surfaceY(x, z - e) - surfaceY(x, z + e)) / (2 * e),
  ).normalize();
}
function frostTextures() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d"),
    data = ctx.createImageData(256, 256);
  const grids = [8, 20, 54, 128].map((n) => ({
    n,
    data: Float32Array.from({ length: (n + 1) * (n + 1) }, () => rand()),
  }));
  function n2(g, x, y) {
    const px = x * g.n,
      py = y * g.n,
      ix = Math.floor(px),
      iy = Math.floor(py),
      fx = px - ix,
      fy = py - iy,
      stride = g.n + 1;
    const a = g.data[iy * stride + ix],
      b = g.data[iy * stride + ix + 1],
      d = g.data[(iy + 1) * stride + ix],
      e = g.data[(iy + 1) * stride + ix + 1];
    return (a + (b - a) * fx) * (1 - fy) + (d + (e - d) * fx) * fy;
  }
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const h =
        n2(grids[0], x / 256, y / 256) * 0.22 +
        n2(grids[1], x / 256, y / 256) * 0.29 +
        n2(grids[2], x / 256, y / 256) * 0.31 +
        n2(grids[3], x / 256, y / 256) * 0.18;
      const v = 35 + h * 215,
        idx = (y * 256 + x) * 4;
      data.data[idx] = data.data[idx + 1] = data.data[idx + 2] = v;
      data.data[idx + 3] = 255;
    }
  ctx.putImageData(data, 0, 0);
  const bump = new THREE.CanvasTexture(c);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  const diffuse = document.createElement("canvas");
  diffuse.width = diffuse.height = 256;
  const dc = diffuse.getContext("2d");
  dc.fillStyle = "#f7fcff";
  dc.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5800; i++) {
    const x = rand() * 256,
      y = rand() * 256;
    dc.fillStyle = rand() > 0.5 ? "#b8c9d428" : "#ffffff88";
    dc.beginPath();
    dc.moveTo(x, y);
    dc.lineTo(x + 1 + rand() * 3, y - rand() * 2);
    dc.lineTo(x + rand() * 2, y + 1 + rand() * 3);
    dc.fill();
  }
  const color = new THREE.CanvasTexture(diffuse);
  color.colorSpace = THREE.SRGBColorSpace;
  return { bump, color };
}
const frost = frostTextures();
const iceGeo = new THREE.SphereGeometry(
  R,
  64,
  36,
  0,
  Math.PI * 2,
  0,
  Math.PI / 2,
);
const iceVerts = iceGeo.attributes.position;
for (let i = 0; i < iceVerts.count; i++) {
  const x = iceVerts.getX(i), z = iceVerts.getZ(i);
  iceVerts.setXYZ(i, x, surfaceY(x, z), z);
}
iceGeo.computeVertexNormals();
const iceMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: frost.color,
  bumpMap: frost.bump,
  bumpScale: 0.075,
  roughness: 0.83,
  vertexColors: true,
});
const ice = mesh(iceGeo, iceMat, iceGroup);
ice.castShadow = false;
ice.receiveShadow = true;
iceMat.onBeforeCompile = (shader) => {
  shader.uniforms.iceInk = { value: stainTexture };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vIceInk;")
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\nvIceInk=position.xz/${inkDiameter.toFixed(6)}+0.5;vIceInk.y=1.0-vIceInk.y;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nuniform sampler2D iceInk;varying vec2 vIceInk;",
    )
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nvec4 ink=texture2D(iceInk,vIceInk);diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,ink.a*.95);",
    );
};
iceMat.customProgramCacheKey = () => "absorbed-ice-v1";
const bowlLight = new THREE.PointLight("#ffffff", 0, 8, 2);
scene.add(bowlLight);
const pourLight = new THREE.SpotLight("#ffffff", 0, 9, 0.63, 0.6, 2);
pourLight.castShadow = true;
pourLight.shadow.mapSize.set(1024, 1024);
pourLight.shadow.bias = 0.0001;
pourLight.shadow.normalBias = 0.035;
pourLight.shadow.intensity = 0.25;
pourLight.shadow.camera.far = 9;
pourLight.shadow.camera.near = 0.3;
scene.add(pourLight, pourLight.target);
// Thin overlapping ice plates, rather than spherical grains.
const crystalGeo = new THREE.BufferGeometry();
crystalGeo.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(
    [-1, 0, -0.4, 0.7, 0.16, -0.8, 1, 0, 0.6, -0.5, 0.12, 1],
    3,
  ),
);
crystalGeo.setIndex([0, 1, 2, 0, 2, 3]);
crystalGeo.computeVertexNormals();
const crystalMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.52,
  metalness: 0.03,
  side: THREE.DoubleSide,
  flatShading: true,
});
const grains = new THREE.InstancedMesh(crystalGeo, crystalMat, 1600);
grains.castShadow = false;
grains.receiveShadow = true;
iceGroup.add(grains);
const dummy = new THREE.Object3D(),
  grainPositions = [];
for (let i = 0; i < 1600; i++) {
  const a = rand() * Math.PI * 2,
    r = Math.pow(rand(), 0.62) * R * 0.95,
    x = r * Math.cos(a),
    z = r * Math.sin(a);
  dummy.position.set(x, surfaceY(x, z) + 0.012, z);
  dummy.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    surfaceNormal(x, z),
  );
  dummy.rotateY(rand() * Math.PI * 2);
  dummy.scale.set(0.01 + rand() * 0.015, 0.015, 0.01 + rand() * 0.015);
  dummy.updateMatrix();
  grains.setMatrixAt(i, dummy.matrix);
  grainPositions.push(dummy.position.clone());
}
crystalMat.onBeforeCompile = (shader) => {
  shader.uniforms.iceInk = { value: stainTexture };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vIceInk;")
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>\nvIceInk=(instanceMatrix*vec4(transformed,1.0)).xz/${inkDiameter.toFixed(6)}+0.5;vIceInk.y=1.0-vIceInk.y;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nuniform sampler2D iceInk;varying vec2 vIceInk;",
    )
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nvec4 ink=texture2D(iceInk,vIceInk);diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,ink.a*.92);",
    );
};
crystalMat.customProgramCacheKey = () => "ice-ink-v2";
const recipes = [
  {
    name: "김치",
    top: "#f1a89a",
    bottom: "#fff9ec",
    sauce: "#da493a",
    flakes: ["#b93622", "#d55328", "#8e2c20", "#df6b32"],
    accentFlakes: ["#427232", "#688d39", "#7da54a"],
    accentCount: 4,
  },
  {
    name: "백김치",
    top: "#ebd898",
    bottom: "#fffbee",
    sauce: "#486e30",
    flakes: ["#427232", "#688d39", "#355829", "#7da54a", "#d2ad42", "#e4c45e", "#c49e36"],
    accentFlakes: ["#b93622", "#d55328", "#df6b32"],
    accentCount: 3,
  },
];
const seasoning = createSeasoning(
  iceGroup, R, surfaceY, surfaceNormal, Math.random,
);
let recipe = 0,
  phase = "intro",
  phaseTime = 0,
  progress = 0,
  shownProgress = 0,
  lidTarget = 0,
  crankAngle = 0,
  crankSpeed = 0,
  drive = 0,
  drag = null,
  activePointer = null,
  lastY = 0,
  time = 0,
  hidden = false;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const food = new THREE.Group();
scene.add(food);
const foodStart = new THREE.Vector3(-1.25, 4.62, 0.3);
food.position.copy(foodStart);
function buildFood() {
  food.clear();
  food.add(foods[recipe]);
}
const sound = new Sound(
  () => time,
  () => hidden,
);
// The nozzle is the origin, so the liquid always joins the bottle at its tip.
const tool = new THREE.Group();
scene.add(tool);
tool.visible = false;
let bottle = sauces[recipe];
const toolRest = new THREE.Vector3();
const pourMat = mat("#bd3424", 0.25);
const stream = mesh(new THREE.CylinderGeometry(1, 1, 1, 7), pourMat);
stream.visible = false;
stream.castShadow = false;
function connectCylinder(m, a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.scale.set(r, d.length(), r);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
// Absorption is painted directly into the ice and crystal shaders.
const stainCanvas = document.createElement("canvas");
stainCanvas.width = stainCanvas.height = 512;
const stainCtx = stainCanvas.getContext("2d");
const stainTexture = new THREE.CanvasTexture(stainCanvas);
stainTexture.colorSpace = THREE.SRGBColorSpace;
const fx = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(1, 0),
  mat("#ffedcf"),
  420,
);
fx.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
fx.frustumCulled = false;
scene.add(fx);
const flakes = Array.from({ length: 420 }, () => ({
  life: 0,
  p: new THREE.Vector3(),
  v: new THREE.Vector3(),
  size: 0,
}));
let flakeHead = 0,
  spawnCarry = 0;
function emitFlake(p, v, size, life = 0.7, color = "#ffffff", settle = false) {
  const i = flakeHead++ % flakes.length,
    f = flakes[i];
  f.p.copy(p);
  f.v.copy(v);
  f.size = size;
  f.life = life;
  f.settle = settle;
  fx.setColorAt(i, new THREE.Color(color));
  fx.instanceColor.needsUpdate = true;
}
const touchTarget = new THREE.Vector3(0.3, 0.4, 0),
  liquidPoint = new THREE.Vector3(0.3, 0.4, 0),
  nozzle = new THREE.Vector3(),
  surface = new THREE.Vector3();
let dwellTime = 0;
let touching = false,
  validTouch = false,
  lastDeposit = null,
  depositTimer = 0,
  toolSqueeze = 0,
  flow = 0,
  dirtyTexture = false;
const inkStamp = document.createElement("canvas");
inkStamp.width = inkStamp.height = 96;
const inkCtx = inkStamp.getContext("2d"),
  wicking = [];
let inkUpload = 0;
function makeInkStamp() {
  const size = inkStamp.width,
    data = inkCtx.createImageData(size, size),
    hex = new THREE.Color(recipes[recipe].sauce).getHex();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x - size / 2) / (size * 0.46),
        dy = (y - size / 2) / (size * 0.46),
        a = Math.atan2(dy, dx),
        r =
          Math.sqrt(dx * dx + dy * dy) *
          (1 + 0.06 * Math.sin(a * 9) + 0.03 * Math.cos(a * 17)),
        idx = (y * size + x) * 4;
      data.data[idx] = hex >> 16;
      data.data[idx + 1] = (hex >> 8) & 255;
      data.data[idx + 2] = hex & 255;
      data.data[idx + 3] =
        255 * Math.pow(Math.max(0, 1 - r * r), 2.1) * (0.58 + rand() * 0.42);
    }
  inkCtx.putImageData(data, 0, 0);
}
function stainDab(x, z, r, alpha) {
  const size = stainCanvas.width,
    scale = size / inkDiameter,
    cx = (x / inkDiameter + 0.5) * size,
    cy = (z / inkDiameter + 0.5) * size;
  stainCtx.globalAlpha = alpha;
  stainCtx.drawImage(
    inkStamp,
    cx - r * scale,
    cy - r * scale,
    r * scale * 2,
    r * scale * 2,
  );
  stainCtx.globalAlpha = 1;
  dirtyTexture = true;
}
function addSauce(x, z, r) {
  if (x * x + z * z > R * R * 0.96) return;
  r *= 0.85;
  // Keep the original absorption reach, but deposit a thinner sauce line.
  const lineRadius = r * 0.7;
  stainDab(x, z, lineRadius * 2.05, 0.18);
  stainDab(x, z, lineRadius * 1.1, 0.3);
  wicking.push({ x, z, r, born: time, stage: 0 });
  if (wicking.length > 800) wicking.shift();
}
function updateAbsorption() {
  for (let i = wicking.length - 1; i >= 0; i--) {
    const d = wicking[i],
      age = time - d.born;
    if (age > [0.1, 0.3, 0.65, 1.05][d.stage]) {
      stainDab(
        d.x,
        d.z,
        d.r * [2.3, 2.9, 3.4, 3.8][d.stage],
        [0.1, 0.08, 0.05, 0.035][d.stage],
      );
      d.stage++;
      if (d.stage === 4) wicking.splice(i, 1);
    }
  }
  if (dirtyTexture && time - inkUpload > 1 / 30) {
    stainTexture.needsUpdate = true;
    dirtyTexture = false;
    inkUpload = time;
  }
}

function configureRecipe() {
  buildFood();
  const c = iceGeo.attributes.position,
    colors = [],
    b = new THREE.Color(recipes[recipe].bottom),
    t = new THREE.Color(recipes[recipe].top);
  for (let i = 0; i < c.count; i++) {
    const v = b.clone().lerp(t, Math.max(0, c.getY(i) / H) * 0.56);
    colors.push(v.r, v.g, v.b);
  }
  iceGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  iceMat.needsUpdate = true;
  for (let i = 0; i < grainPositions.length; i++) {
    const v = b
      .clone()
      .lerp(t, (grainPositions[i].y / H) * 0.42)
      .lerp(new THREE.Color("#ffffff"), 0.28);
    grains.setColorAt(i, v);
  }
  grains.instanceColor.needsUpdate = true;
  tool.clear();
  bottle = sauces[recipe];
  bottle.squeeze(0);
  tool.add(bottle.root);
  toolRest.set(2.8, bottle.height + 0.012, 0.12);
  pourMat.color.set(recipes[recipe].sauce);
  fx.material.color.set("#ffffff");
  seasoning.configure(
    recipes[recipe].flakes,
    recipes[recipe].accentFlakes,
    recipes[recipe].accentCount,
  );
  makeInkStamp();
}
function resetSauce() {
  stainCtx.clearRect(0, 0, 512, 512);
  stainTexture.needsUpdate = true;
  wicking.length = 0;
  lastDeposit = null;
  flow = 0;
  dwellTime = 0;
  dirtyTexture = false;
}
$("start").onclick = () => {
  sound.unlock();
  sound.tap("glass");
  $("start").hidden = true;
  setPhase("closed");
  canvas.focus({ preventScroll: true });
};
const guideSeen = new Set();
let guideUntil = 0;
function setPhase(next) {
  phase = next;
  phaseTime = 0;
  const guided = ["closed", "open", "loaded", "grind"].includes(next);
  guideUntil = guided && !guideSeen.has(next) ? time + 2.6 : 0;
  if (guided) guideSeen.add(next);
  $("action").hidden = next !== "draw";
  $("save").hidden = $("retry").hidden = next !== "done";
  const messages = {
    closed: "뚜껑열기",
    open: recipes[recipe].name + "넣기",
    loaded: "뚜껑닫기",
    grind: "빙수갈기",
    draw: ["김칫국 붓기", "백김칫국 붓기"][recipe],
    done: recipes[recipe].name + "빙수 완성!",
  };
  const message = messages[next] || "";
  $("instruction").hidden = !message;
  $("instruction-text").textContent = message;
  $("instruction").classList.remove("pop");
  if (message) {
    void $("instruction").offsetWidth;
    $("instruction").classList.add("pop");
  }
  $("announcement").textContent = message;
  canvas.dataset.phase = next;
  const cue = {
    opening: "openLid",
    closing: "closeLid",
    loading: "putKimchi",
    done: "end",
  }[next];
  if (cue) sound.play(cue);
  if (next === "serving" || next === "presenting") sound.bowl();
  if (next === "done") selectChoice($("save"));
}
function action() {
  sound.unlock();
  if (phase === "closed") {
    lidTarget = -1.3;
    setPhase("opening");
  } else if (phase === "open") {
    setPhase("loading");
  } else if (phase === "loaded") {
    lidTarget = 0;
    setPhase("closing");
  } else if (phase === "draw") {
    stopInput();
    orbitYaw = orbitVelocity = 0;
    orbitPitch = 0.12;
    setPhase("presenting");
  }
}

function stopInput() {
  sound.endSqueeze();
  touching = false;
  validTouch = false;
  drag = null;
  activePointer = null;
  lastDeposit = null;
  drive = 0;
}
$("action").onclick = () => {
  if (phase === "draw") action();
};
$("retry").onclick = () => {
  if (phase !== "done") return;
  sound.unlock();
  stopInput();
  startToss();
};
const ray = new THREE.Raycaster(),
  pointer = new THREE.Vector2();
function cast(e, objects) {
  const r = canvas.getBoundingClientRect();
  pointer.set(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    (-(e.clientY - r.top) / r.height) * 2 + 1,
  );
  ray.setFromCamera(pointer, camera);
  return ray.intersectObjects(objects, true);
}
const hoverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hoverPoint = new THREE.Vector3();
function targetTouch(e) {
  const hit = cast(e, [ice])[0];
  validTouch = !!hit;
  if (hit) {
    touchTarget.copy(iceGroup.worldToLocal(hit.point.clone()));
    touchTarget.y = surfaceY(touchTarget.x, touchTarget.z);
  } else {
    lastDeposit = null;
    hoverPlane.constant = -(dish.position.y + 0.75);
    if (ray.ray.intersectPlane(hoverPlane, hoverPoint)) {
      touchTarget.copy(iceGroup.worldToLocal(hoverPoint));
      touchTarget.x = THREE.MathUtils.clamp(touchTarget.x, -1.6, 1.6);
      touchTarget.z = THREE.MathUtils.clamp(touchTarget.z, -1.6, 1.6);
      touchTarget.y = surfaceY(touchTarget.x, touchTarget.z);
    }
  }
}
function nearGuide(e) {
  const r = canvas.getBoundingClientRect();
  return (
    Math.hypot(
      e.clientX - r.left - guideScreen.x,
      e.clientY - r.top - guideScreen.y,
    ) < 48
  );
}
canvas.onpointerdown = (e) => {
  if (
    activePointer !== null ||
    !["closed", "open", "loaded", "grind", "draw", "done"].includes(phase) ||
    (e.pointerType === "mouse" && e.button !== 0)
  )
    return;
  e.preventDefault();
  sound.unlock();
  activePointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  if (phase === "draw") {
    drag = "draw";
    touching = true;
    targetTouch(e);
    liquidPoint.copy(touchTarget);
    lastDeposit = null;
  } else if (phase === "done") {
    drag = "orbit";
    lastX = e.clientX;
    lastY = e.clientY;
    orbitVelocity = 0;
  } else if (phase === "grind") {
    if (cast(e, [crank]).length || nearGuide(e)) {
      drag = "grind";
      lastY = e.clientY;
      drive = 0.1;
    }
  } else if (phase === "closed" && (cast(e, [lid]).length || nearGuide(e)))
    action();
  else if (phase === "open" && (cast(e, [food]).length || nearGuide(e)))
    action();
  else if (phase === "loaded" && (cast(e, [lid]).length || nearGuide(e)))
    action();
};
canvas.onpointermove = (e) => {
  if (phase === "draw" && e.pointerType === "mouse") {
    targetTouch(e);
    if (activePointer === null) return;
  }
  if (e.pointerId !== activePointer) return;
  if (drag === "grind" && phase === "grind") {
    const dy = e.clientY - lastY;
    lastY = e.clientY;
    const rect = canvas.getBoundingClientRect(),
      delta = Math.abs(dy) / rect.height;
    crankSpeed = Math.min(20, crankSpeed + delta * 150);
    drive = Math.min(1, drive + delta * 11);
  } else if (drag === "orbit" && phase === "done") {
    const dx = e.clientX - lastX,
      dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    orbitYaw += (dx / canvas.clientWidth) * 6;
    orbitPitch += (dy / canvas.clientHeight) * 2.8;
    orbitVelocity = THREE.MathUtils.clamp(
      (dx / canvas.clientWidth) * 45,
      -3,
      3,
    );
    limitOrbit();
  } else if (drag === "draw" && phase === "draw") targetTouch(e);
};
function finishStroke() {
  if (phase !== "draw" || drag !== "draw" || !validTouch || !lastDeposit)
    return;
  const distance = lastDeposit.distanceTo(touchTarget),
    steps = Math.max(1, Math.min(120, Math.ceil(distance / 0.009)));
  for (let i = 1; i <= steps; i++)
    addSauce(
      THREE.MathUtils.lerp(lastDeposit.x, touchTarget.x, i / steps),
      THREE.MathUtils.lerp(lastDeposit.z, touchTarget.z, i / steps),
      0.04,
    );
}
canvas.onpointerup = (e) => {
  if (activePointer === e.pointerId) {
    finishStroke();
    stopInput();
  }
};
canvas.onpointercancel = canvas.onlostpointercapture = (e) => {
  if (activePointer === e.pointerId) stopInput();
};
canvas.onpointerleave = () => {
  if (activePointer === null) validTouch = false;
};
canvas.onkeydown = (e) => {
  if (
    (e.key === "Enter" || e.key === " ") &&
    ["closed", "open", "loaded"].includes(phase)
  ) {
    e.preventDefault();
    action();
  } else if (phase === "grind" && ["ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
    sound.unlock();
    crankSpeed = Math.min(20, crankSpeed + 7);
    drive = 1;
  } else if (phase === "done" && e.key.startsWith("Arrow")) {
    e.preventDefault();
    if (e.key === "ArrowLeft") orbitYaw -= 0.2;
    if (e.key === "ArrowRight") orbitYaw += 0.2;
    if (e.key === "ArrowUp") orbitPitch -= 0.06;
    if (e.key === "ArrowDown") orbitPitch += 0.06;
    limitOrbit();
  }
};
window.addEventListener("blur", stopInput);
document.addEventListener("visibilitychange", () => {
  hidden = document.hidden;
  if (hidden) {
    stopInput();
    sound.stopEffects();
    sound.ctx?.suspend();
  } else if (sound.ctx) sound.ctx.resume().catch(() => {});
});
$("save").onclick = async () => {
  sound.unlock();
  const btn = $("save");
  btn.disabled = true;
  renderScene();
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  try {
    const blob = await new Promise((resolve) =>
      out.toBlob(resolve, "image/png"),
    );
    if (!blob) throw Error("PNG");
    const file = new File([blob], `kimchi-ice-${recipe + 1}.png`, {
      type: "image/png",
    });
    if (
      /Android|iPhone|iPad/i.test(navigator.userAgent) &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({ files: [file] });
    } else {
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    $("announcement").textContent = "사진을 저장했습니다";
    sound.tap("glass");
  } catch (e) {
    if (e.name !== "AbortError") {
      $("announcement").textContent = "저장하지 못했습니다. 다시 시도해주세요";
      btn.textContent = "save";
    }
  } finally {
    btn.disabled = false;
  }
};
const smooth = (a, b, k, dt) =>
  THREE.MathUtils.lerp(a, b, 1 - Math.exp(-k * dt));
const ease = (t) => t * t * (3 - 2 * t);
function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(
    Math.max(1, Math.round(r.width)),
    Math.max(1, Math.round(r.height)),
    false,
  );
  viewAspect = r.width / r.height;
  camera.left = -frameHeight * viewAspect / 2;
  camera.right = -camera.left;
  camera.top = frameHeight / 2;
  camera.bottom = -camera.top;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($("game"));
visualViewport?.addEventListener("resize", resize);
resize();
let serve = 0,
  showcase = 0,
  orbitYaw = 0,
  orbitPitch = 0,
  orbitVelocity = 0,
  lastX = 0;
const orbitYawLimit = THREE.MathUtils.degToRad(55);
function limitOrbit() {
  // Keep the finished view on the front, including keyboard input and inertia.
  orbitYaw = THREE.MathUtils.clamp(orbitYaw, -orbitYawLimit, orbitYawLimit);
  orbitPitch = THREE.MathUtils.clamp(orbitPitch, -0.25, 0.7);
  if (Math.abs(orbitYaw) >= orbitYawLimit && orbitYaw * orbitVelocity > 0)
    orbitVelocity = 0;
}
const guidePoint = new THREE.Vector3(),
  guideBounds = new THREE.Box3(),
  guideScreen = { x: 0, y: 0 };
const homeDir = new THREE.Vector3(0, 0.22, 1).normalize(),
  homeLook = new THREE.Vector3(0, 2.15, 0),
  bowlAnchor = new THREE.Vector3();
const finishCamera = new THREE.Vector3(),
  finishLook = new THREE.Vector3(0, 2.15, 0.1),
  finishDir = new THREE.Vector3(0, 0.22, 1).normalize();
function updateCamera(dt) {
  const targetServe = ["serving", "draw"].includes(phase) ? 1 : 0;
  serve = smooth(serve, targetServe, reduceMotion ? 12 : 4, dt);
  if (Math.abs(serve - targetServe) < 0.001) serve = targetServe;
  const presented = ["presenting", "done"].includes(phase);
  if (phase === "tossing")
    showcase = 1 - ease(THREE.MathUtils.clamp((phaseTime - 1.2) / 0.95, 0, 1));
  else showcase = smooth(showcase, presented ? 1 : 0, 4.2, dt);
  const aspect = viewAspect;
  const finishFrame = Math.max(2.1 / aspect, 3.8);
  finishCamera
    .copy(finishLook)
    .addScaledVector(finishDir, 18);
  const homeWidth = THREE.MathUtils.lerp(
    6.3,
    9.8,
    THREE.MathUtils.clamp((aspect - 0.5) / 0.35, 0, 1),
  );
  const workingFrame = THREE.MathUtils.lerp(
    Math.max(homeWidth / aspect, 10.2),
    Math.max(1.85 / aspect, 2.85),
    serve,
  );
  frameHeight = smooth(frameHeight,
    THREE.MathUtils.lerp(workingFrame, Math.max(5.4 / aspect, 7.0), showcase),
    7, dt);
  presentationHeight = smooth(presentationHeight,
    THREE.MathUtils.lerp(workingFrame, finishFrame, showcase),
    7, dt);
  camera.left = -frameHeight * aspect / 2;
  camera.right = -camera.left;
  camera.top = frameHeight / 2;
  camera.bottom = -camera.top;
  camera.updateProjectionMatrix();
  lookGoal.copy(homeLook).lerp(new THREE.Vector3(0, 0.8, 2.55), serve);
  const dir = homeDir
    .clone()
    .lerp(new THREE.Vector3(0, 0.86, 0.51).normalize(), serve)
    .normalize();
  cameraGoal
    .copy(lookGoal)
    .addScaledVector(dir, 18)
    .lerp(finishCamera, showcase);
  lookGoal.lerp(finishLook, showcase);
  if (!reduceMotion) {
    // Keep the breathing subtle at close range and quieter during touch/drag.
    const homeFrame = Math.max(homeWidth / aspect, 10.2);
    const framing = Math.min(1, Math.min(frameHeight, presentationHeight) / homeFrame);
    const strength = phase === "intro" ? 1 :
      (activePointer === null ? 0.65 : 0.25) * framing;
    const breath = Math.sin(time * Math.PI * 2 / 5.5) * strength;
    const sway = Math.sin(time * Math.PI * 2 / 9.5) * strength;
    cameraGoal.x += sway * 0.07;
    cameraGoal.y += breath * 0.055;
    lookGoal.x += sway * 0.035;
    lookGoal.y += breath * 0.035;
  }
  camera.position.lerp(cameraGoal, 1 - Math.exp(-7 * dt));
  look.lerp(lookGoal, 1 - Math.exp(-7 * dt));
  camera.lookAt(look);
  presentationCamera.position.copy(camera.position);
  presentationCamera.quaternion.copy(camera.quaternion);
  presentationCamera.left = -presentationHeight * aspect / 2;
  presentationCamera.right = -presentationCamera.left;
  presentationCamera.top = presentationHeight / 2;
  presentationCamera.bottom = -presentationCamera.top;
  presentationCamera.updateProjectionMatrix();
  presentationCamera.updateMatrixWorld();
  // Bring the finished bowl toward the center while keeping the character behind it.
  bowlAnchor.set(0,
    finishLook.y + (finishDir.y * (3.2 - finishLook.z) - finishFrame * 0.24) / finishDir.z,
    3.2);
  if (phase !== "tossing") {
    dish.position
      .copy(dishHome)
      .lerp(new THREE.Vector3(0, 0.015, 2.55), ease(serve))
      .lerp(bowlAnchor, showcase);
    dish.scale.setScalar(1);
    if (phase === "done" && drag !== "orbit") {
      orbitYaw += orbitVelocity * dt;
      orbitVelocity *= Math.exp(-dt * 7);
      limitOrbit();
    }
    dish.rotation.y = smooth(dish.rotation.y, presented ? orbitYaw : 0, 12, dt);
    dish.rotation.x = smooth(
      dish.rotation.x,
      presented ? orbitPitch : 0,
      12,
      dt,
    );
    dish.rotation.z = smooth(dish.rotation.z, 0, 12, dt);
  }
  bowlLight.position.copy(dish.position).add(new THREE.Vector3(-1.1, 1.8, 2.9));
  bowlLight.intensity = showcase * 2.5;
  pourLight.position
    .copy(dish.position)
    .add(new THREE.Vector3(-1.65, 4.2, 1.6));
  pourLight.target.position
    .copy(dish.position)
    .add(new THREE.Vector3(0, 0.7, 0));
  pourLight.intensity = serve * 13 * (1 - showcase);
  pourLight.visible = serve > 0.01 && showcase < 0.95;
}

function updateGuide() {
  const applicable = ["closed", "open", "loaded", "grind"].includes(
      phase,
    ),
    remaining = guideUntil - time;
  $("guide").hidden = !applicable || remaining <= 0;
  if (!applicable || remaining <= 0) return;
  $("guide").dataset.mode = phase === "grind"
    ? "vertical"
    : "tap";
  $("guide").style.opacity = String(Math.min(1, remaining / 0.4));
  if (phase === "open")
    guideBounds.setFromObject(food).getCenter(guidePoint);
  else if (phase === "grind") {
    guidePoint.set(0.055, -0.19, 0.02);
    crank.localToWorld(guidePoint);
  } else {
    guideBounds.setFromObject(lid).getCenter(guidePoint);
  }
  guidePoint.project(camera);
  guideScreen.x = THREE.MathUtils.clamp(
    (guidePoint.x * 0.5 + 0.5) * canvas.clientWidth,
    38,
    canvas.clientWidth - 38,
  );
  guideScreen.y = THREE.MathUtils.clamp(
    (-0.5 * guidePoint.y + 0.5) * canvas.clientHeight,
    100,
    canvas.clientHeight - 108,
  );
  $("guide").style.left = guideScreen.x + "px";
  $("guide").style.top = guideScreen.y + "px";
}
const tossStart = new THREE.Vector3(),
  tossRotation = new THREE.Quaternion(),
  upright = new THREE.Quaternion();
let iceDetached = false,
  tossWhooshed = false,
  tossReturned = false,
  spillInk = null;
function startToss() {
  tossStart.copy(dish.position);
  tossRotation.copy(dish.quaternion);
  iceDetached = true;
  tossWhooshed = false;
  tossReturned = false;
  spillInk = stainCtx.getImageData(0, 0, 512, 512).data;
  fx.material.color.set("#ffffff");
  setPhase("tossing");
}

function tossSound() {
  if (!sound.ctx) return;
  const c = sound.ctx,
    n = c.currentTime,
    source = c.createBufferSource(),
    filter = c.createBiquadFilter(),
    gain = c.createGain();
  source.buffer = sound.buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(500, n);
  filter.frequency.exponentialRampToValueAtTime(3100, n + 0.07);
  filter.frequency.exponentialRampToValueAtTime(430, n + 0.3);
  gain.gain.setValueAtTime(0.001, n);
  gain.gain.exponentialRampToValueAtTime(0.62, n + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, n + 0.34);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(sound.master);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
  source.start();
  source.stop(n + 0.36);
}

function resetRound() {
  dish.add(iceGroup);
  iceGroup.position.set(0, 0.075, 0);
  iceGroup.rotation.set(0, 0, 0);
  iceGroup.scale.set(1, 0.025, 1);
  iceGroup.visible = false;
  iceDetached = false;
  recipe = (recipe + 1) % recipes.length;
  progress = shownProgress = 0;
  crankSpeed = 0;
  crankAngle = 0;
  resetSauce();
  configureRecipe();
  food.position.copy(foodStart);
  food.rotation.set(0, 0, 0);
  food.scale.setScalar(1);
  food.visible = true;
  orbitYaw = orbitPitch = orbitVelocity = 0;
  showcase = serve = 0;
  dish.position.copy(dishHome);
  dish.scale.setScalar(1);
  dish.rotation.set(0, 0, 0);
  tool.visible = false;
  lidTarget = 0;
  setPhase("closed");
}
function updateToss() {
  if (phase !== "tossing") return;
  const t = phaseTime;
  dish.position.copy(tossStart);
  let tilt = 0;
  if (t < 0.28) {
    dish.quaternion.copy(tossRotation).slerp(upright, ease(t / 0.28));
  } else {
    if (t < 0.38) tilt = -0.1 * ease((t - 0.28) / 0.1);
    else if (t < 0.66)
      tilt = -0.1 + 1.4 * (1 - Math.pow(1 - (t - 0.38) / 0.28, 3));
    else if (t < 0.78) tilt = 1.3;
    else if (t < 1.18) tilt = 1.3 * (1 - ease((t - 0.78) / 0.4));
    dish.rotation.set(0, 0, tilt);
  }
  const empty = THREE.MathUtils.clamp((t - 0.46) / 0.18, 0, 1);
  iceGroup.position.set(-0.28 * empty, iceBaseHeight - 0.1 * empty, 0);
  iceGroup.scale.set(
    1 - empty * 0.6,
    Math.max(0.001, 1 - empty),
    1 - empty * 0.48,
  );
  iceGroup.visible = empty < 1;
  if (t > 0.46 && !tossWhooshed) {
    tossWhooshed = true;
    tossSound();
    scene.updateMatrixWorld(true);
    for (let i = 0; i < 310; i++) {
      const p = dish.localToWorld(
          new THREE.Vector3(
            -0.6 + rand() * 0.16,
            0.59 + rand() * 0.2,
            (rand() - 0.5) * 0.67,
          ),
        ),
        v = new THREE.Vector3(
          -6.8 - rand() * 3.4,
          0.1 + rand() * 1.6,
          (rand() - 0.5) * 1.9,
        );
      const x = rand(),
        z = rand(),
        ix = (Math.floor(z * 511) * 512 + Math.floor(x * 511)) * 4,
        col = new THREE.Color(recipes[recipe].bottom).lerp(
          new THREE.Color(recipes[recipe].top),
          rand() * 0.6,
        );
      if (spillInk && spillInk[ix + 3] > 40)
        col.lerp(
          new THREE.Color(recipes[recipe].sauce),
          spillInk[ix + 3] / 255,
        );
      emitFlake(p, v, 0.017 + rand() * 0.038, 0.65 + rand() * 0.24, col);
    }
  }
  if (t >= 1.2) {
    if (!tossReturned) {
      tossReturned = true;
      sound.bowl();
    }
    const u = ease(Math.min(1, (t - 1.2) / 0.95));
    dish.position.copy(tossStart).lerp(dishHome, u);
    dish.position.y += Math.sin(u * Math.PI) * 0.14;
    dish.scale.setScalar(1);
  }
  if (t > 2.17) {
    spillInk = null;
    resetRound();
  }
}

function updatePhases(dt) {
  phaseTime += dt;
  if (phase === "opening" && phaseTime > 0.65) setPhase("open");
  if (phase === "loading") {
    const t = Math.min(1, phaseTime / 0.95),
      s = ease(t);
    food.position.lerpVectors(foodStart, new THREE.Vector3(0, 2.62, -0.1), s);
    food.position.y += Math.sin(t * Math.PI) * 0.25;
    food.rotation.z = Math.sin(t * Math.PI) * 0.3;
    food.scale.setScalar(1);
    if (t === 1) {
      setPhase("loaded");
    }
  }
  if (phase === "closing") {
    food.position.y = smooth(food.position.y, 2.05, 8, dt);
    if (phaseTime > 0.35) food.visible = false;
    if (phaseTime > 0.65) {
      setPhase("grind");
    }
  }
  if (phase === "grind") {
    drive = Math.max(0, drive - dt * 1.9);
    crankSpeed = smooth(crankSpeed, drive * 12, 5, dt);
    progress = Math.min(1, progress + crankSpeed * dt * 0.019);
    crankAngle += crankSpeed * dt;
    if (progress >= 1) {
      stopInput();
      setPhase("settling");
      sound.tap("glass");
    }
  }
  if (phase === "settling") {
    crankSpeed = smooth(crankSpeed, 0, 4, dt);
    crankAngle += crankSpeed * dt;
    if (phaseTime > 0.95) {
      setPhase("serving");
    }
  }
  if (phase === "serving" && phaseTime > 1.35) {
    liquidPoint.set(0.3, surfaceY(0.3, 0), 0);
    touchTarget.copy(liquidPoint);
    setPhase("draw");
  }
  if (phase === "presenting" && phaseTime > 1.7) setPhase("done");
  lid.rotation.x = smooth(lid.rotation.x, lidTarget, 9, dt);
  crank.rotation.x = crankAngle;
  const shake = phase === "grind" ? Math.min(1, crankSpeed / 12) : 0;
  machine.rotation.z = reduceMotion ? 0 : Math.sin(time * 39) * shake * 0.009;
  machine.position.y = reduceMotion ? 0 : Math.sin(time * 51) * shake * 0.006;
  tail.rotation.z = Math.sin(time * 6) * shake * 0.03;
  shownProgress = smooth(shownProgress, progress, 8, dt);
  if (!iceDetached) {
    iceGroup.visible = shownProgress > 0.002;
    const spread = 0.3 + 0.7 * Math.pow(shownProgress, 0.9);
    iceGroup.scale.set(spread, Math.max(0.001, shownProgress), spread);
    iceGroup.position.y = THREE.MathUtils.lerp(
      0.075,
      iceBaseHeight,
      shownProgress,
    );
  }
  if (["intro", "closed", "opening", "open"].includes(phase)) {
    food.rotation.y = Math.sin(time * 0.85) * 0.15;
    food.position.y = foodStart.y + Math.sin(time * 1.6) * 0.085;
  }
  if (phase === "grind" || phase === "settling") {
    spawnCarry += Math.min(1, crankSpeed / 10) * dt * 140;
    while (spawnCarry >= 1) {
      spawnCarry--;
      emitFlake(
        new THREE.Vector3(
          (rand() - 0.5) * 0.4,
          1.45,
          (rand() - 0.5) * 0.3 + 0.08,
        ),
        new THREE.Vector3(
          (rand() - 0.5) * 0.45,
          -0.9 - rand() * 0.5,
          (rand() - 0.5) * 0.45,
        ),
        0.012 + rand() * 0.019,
        0.58,
        rand() < 0.025
          ? seasoning.sampleColor()
          : recipes[recipe].bottom,
        true,
      );
    }
  }
  return shake;
}
function updatePour(dt) {
  const pouring = phase === "draw" || phase === "serving";
  tool.visible = pouring;
  const targetFlow = phase === "draw" && touching && validTouch ? 1 : 0;
  if (targetFlow) sound.squeeze();
  flow = smooth(flow, targetFlow, targetFlow ? 20 : 26, dt);
  toolSqueeze = smooth(toolSqueeze, targetFlow, 18, dt);
  bottle.squeeze(toolSqueeze);
  if (!pouring) {
    tool.position.copy(toolRest);
    tool.rotation.set(0, 0, Math.PI);
    stream.visible = false;
    lastDeposit = null;
    depositTimer = dwellTime = 0;
    return;
  }
  liquidPoint.lerp(touchTarget, 1 - Math.exp(-22 * dt));
  liquidPoint.y = surfaceY(liquidPoint.x, liquidPoint.z);
  surface.copy(liquidPoint);
  iceGroup.localToWorld(surface);
  nozzle.copy(surface).add(new THREE.Vector3(0.02, 0.28, 0));
  const lift = ease(serve);
  tool.position.copy(toolRest).lerp(nozzle, lift);
  tool.rotation.set(
    -0.28 * lift,
    0,
    THREE.MathUtils.lerp(Math.PI, -0.34 + Math.sin(time * 3) * 0.009, lift),
  );
  stream.visible = tool.visible && flow > 0.05;
  connectCylinder(stream, nozzle, surface, 0.008 * flow);
  if (!targetFlow) {
    lastDeposit = null;
    depositTimer = 0;
    dwellTime = 0;
    return;
  }
  depositTimer += dt;
  {
    const distance = lastDeposit ? lastDeposit.distanceTo(liquidPoint) : 0;
    if (!lastDeposit || distance > 0.004 || depositTimer > 0.045) {
      const count = Math.max(1, Math.min(80, Math.ceil(distance / 0.009)));
      const start = lastDeposit || liquidPoint;
      const dwell = distance < 0.007;
      dwellTime = dwell ? dwellTime + depositTimer : 0;
      const radius = dwell
        ? 0.047 + Math.min(0.095, Math.sqrt(dwellTime) * 0.043)
        : 0.04;
      for (let i = 1; i <= count; i++) {
        const x = THREE.MathUtils.lerp(start.x, liquidPoint.x, i / count),
          z = THREE.MathUtils.lerp(start.z, liquidPoint.z, i / count);
        addSauce(x, z, radius);
      }
      lastDeposit = liquidPoint.clone();
      depositTimer = 0;
    }
  }
}
const landingPoint = new THREE.Vector3();
function updateFlakes(dt) {
  for (let i = 0; i < flakes.length; i++) {
    const f = flakes[i];
    if (f.life > 0) {
      f.life -= dt;
      f.v.y -= dt * 2.6;
      f.p.addScaledVector(f.v, dt);
      if (f.settle) {
        landingPoint.copy(f.p);
        dish.worldToLocal(landingPoint);
        const spread = iceGroup.scale.x;
        const x = landingPoint.x / spread,
          z = landingPoint.z / spread;
        const landingHeight =
          x * x + z * z < R * R
            ? iceGroup.position.y + surfaceY(x, z) * iceGroup.scale.y
            : 0.15;
        if (landingPoint.y <= Math.max(0.15, landingHeight)) f.life = 0;
      }
      dummy.position.copy(f.p);
      dummy.rotation.set(time * 3 + i, time * 2, 0);
      dummy.scale.setScalar(f.life > 0 ? f.size : 0);
    } else dummy.scale.setScalar(0);
    dummy.updateMatrix();
    fx.setMatrixAt(i, dummy.matrix);
  }
  fx.instanceMatrix.needsUpdate = true;
}
const choices = [$("save"), $("retry")];
function selectChoice(choice) {
  for (const button of choices)
    button.dataset.selected = String(button === choice);
}
for (const button of choices) {
  button.addEventListener("pointerenter", () => selectChoice(button));
  button.addEventListener("focus", () => selectChoice(button));
  button.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      choices.find((other) => other !== button).focus();
    }
  });
}
dish.traverse((object) => object.layers.enable(1));
fx.layers.enable(1);
scene.traverse((object) => { if (object.isLight) object.layers.enable(1); });
// Both views remain orthographic. A separate presentation view brings the bowl
// close without magnifying the machine behind it or rescaling either model.
function renderScene() {
  if (showcase < 0.001) {
    renderer.render(scene, camera);
    return;
  }
  dish.visible = fx.visible = false;
  renderer.render(scene, camera);
  dish.visible = fx.visible = true;
  renderer.autoClear = false;
  renderer.shadowMap.autoUpdate = false;
  renderer.clearDepth();
  const background = scene.background;
  scene.background = null;
  renderer.render(scene, presentationCamera);
  scene.background = background;
  renderer.autoClear = true;
  renderer.shadowMap.autoUpdate = true;
}
configureRecipe();
resetSauce();
setPhase("intro");
iceGroup.visible = false;
updateCamera(1);
let last = 0;
function animate(ms) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.04, (ms - last) / 1000 || 0.016);
  last = ms;
  if (hidden) return;
  time += dt;
  models.updateBlink(dt);
  const grind = updatePhases(dt);
  updateCamera(dt);
  updateToss();
  scene.updateMatrixWorld(true);
  updateGuide();
  updatePour(dt);
  updateAbsorption();
  seasoning.update(shownProgress, time, canvas.height, phase === "tossing");
  updateFlakes(dt);
  sound.update(grind, flow);
  renderScene();
}
requestAnimationFrame(animate);
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  stopInput();
  $("error").hidden = false;
  $("error").textContent =
    "화면이 잠시 멈췄어요. 새로고침해서 다시 시작해주세요.";
});
