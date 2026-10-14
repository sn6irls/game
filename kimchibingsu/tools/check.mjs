import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { SOUND_FILES } from "../src/sound.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const checked = new Set();
function exists(file) {
  if (!fs.existsSync(file))
    throw new Error(`Missing asset: ${path.relative(root, file)}`);
}
function module(file) {
  if (checked.has(file)) return;
  exists(file);
  checked.add(file);
  execFileSync(process.execPath, ["--check", file]);
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g))
    module(path.resolve(path.dirname(file), match[1]));
}
module(path.join(root, "src/game.js"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g))
  exists(path.resolve(root, match[1]));
const css = fs.readFileSync(path.join(root, "styles/game.css"), "utf8");
for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g))
  exists(path.resolve(root, "styles", match[1]));
for (const name of Object.values(SOUND_FILES)) {
  const file = path.join(root, "assets/sound", name);
  exists(file);
  const audio = fs.readFileSync(file);
  const id3 = audio.toString("ascii", 0, 3) === "ID3";
  const frame = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
  if (audio.length < 128 || (!id3 && !frame)) throw new Error(`Invalid MP3: ${name}`);
}
for (const name of ["bingsu-machine", "kimchi", "baekkimchi", "bowl", "sauce1", "sauce2", "desk", "plane"]) {
  const buffer = fs.readFileSync(path.join(root, `assets/models/${name}.glb`));
  if (
    buffer.toString("ascii", 0, 4) !== "glTF" ||
    buffer.readUInt32LE(8) !== buffer.length
  )
    throw new Error(`Invalid GLB: ${name}`);
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
  if (!json.meshes?.length) throw new Error(`Empty model: ${name}`);
  if (json.images?.some((image) => image.uri))
    throw new Error(`Model has external texture dependency: ${name}`);
  if (name === "bingsu-machine") {
    for (const names of [["Lid", "normal_hair.003"], ["Crank", "normal_hair.002"], ["LeftTail", "normal_hair.001"], ["Face", "face"]]) {
      if (!json.nodes.some((node) => names.includes(node.name)))
        throw new Error(`Missing animated part: ${names.join(" / ")}`);
    }
  }
}
console.log(
  `PASS: ${checked.size} JavaScript modules, HTML/CSS asset paths, 8 self-contained GLB models, ${Object.keys(SOUND_FILES).length} MP3 sounds.`,
);
