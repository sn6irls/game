// Add game pivots to the artist's exported GLB. Geometry, UVs and image bytes stay intact.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source) throw new Error("Usage: node tools/prepare-model.mjs <bingsu_1.glb>");
const original = fs.readFileSync(source);
if (original.toString("ascii", 0, 4) !== "glTF") throw new Error("Expected a GLB file.");
const jsonLength = original.readUInt32LE(12);
const gltf = JSON.parse(original.subarray(20, 20 + jsonLength));
const roots = gltf.scenes[gltf.scene || 0].nodes;
function node(name) {
  const index = gltf.nodes.findIndex((n) => n.name === name);
  if (index < 0) throw new Error(`Missing author model part: ${name}`);
  return index;
}
function pivot(name, part, position) {
  const child = node(part), parent = gltf.nodes.length;
  if (gltf.nodes[child].matrix || gltf.nodes[child].translation)
    throw new Error(`Unexpected transform on ${part}`);
  gltf.nodes[child].translation = position.map((v) => -v);
  gltf.nodes.push({ name, translation: position, children: [child] });
  roots.splice(roots.indexOf(child), 1, parent);
}
pivot("Lid", "normal_hair.003", [0, 0.739, -0.16]);
pivot("Crank", "normal_hair.002", [0.36, 0.515, -0.14]);
pivot("LeftTail", "normal_hair.001", [-0.36, 0.515, -0.14]);
for (const [from, to] of [
  ["Cylinder", "MachineBody"],
  ["Plane", "Glasses"], ["face", "Face"], ["normal_hair", "Hair"],
]) gltf.nodes[node(from)].name = to;
const oldBowl = gltf.nodes.find((part) => part.name === "Cylinder.001");
if (oldBowl) oldBowl.name = "Bowl";
const json = Buffer.from(JSON.stringify(gltf));
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
json.copy(padded);
const tail = original.subarray(20 + jsonLength);
const header = Buffer.alloc(20);
header.write("glTF");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + padded.length + tail.length, 8);
header.writeUInt32LE(padded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const destination = fileURLToPath(new URL("../assets/models/bingsu-machine.glb", import.meta.url));
fs.writeFileSync(destination, Buffer.concat([header, padded, tail]));
console.log("Prepared artist model with original mesh, UV and texture data:", destination);
