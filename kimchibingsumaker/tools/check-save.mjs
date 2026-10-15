import assert from "node:assert/strict";
import fs from "node:fs";
import { installImageSave } from "../src/save-image.js";

const nativeTimeout = globalThis.setTimeout;
globalThis.setTimeout = (...args) => nativeTimeout(...args).unref();
const save = { disabled: false }, status = {}, order = [];
let gesture = false, encodedType = "image/jpeg", fail = false, captured;
const output = {
  getContext: () => ({
    fillRect: () => order.push("background"),
    drawImage: () => order.push("copy"),
  }),
  toDataURL: (type, quality) => {
    assert.equal(type, "image/jpeg");
    assert.equal(quality, 0.92);
    assert.equal(output.height, 2048);
    if (fail) throw new Error("Encoding failed");
    return `data:${encodedType};base64,/9j/2Q==`;
  },
};
const anchor = {
  click() {
    assert.equal(gesture, true, "Download must start in the original save tap");
    assert.equal(this.download, "kimchi-ice-1.jpg");
    captured = this.href;
    order.push("download");
  },
  remove() { order.push("cleanup"); },
};
globalThis.window = { devicePixelRatio: 3 };
globalThis.document = {
  getElementById: id => ({ save, announcement: status })[id],
  createElement: tag => {
    assert.ok(["canvas", "a"].includes(tag), "No preview UI is created");
    return tag === "canvas" ? output : anchor;
  },
  body: { append() {} },
};
installImageSave({
  canvas: { clientWidth: 1080, clientHeight: 1920 },
  render: () => order.push("render"),
  filename: () => "kimchi-ice-1.jpg",
});
gesture = true;
assert.equal(save.onclick(), undefined, "The save handler must be synchronous");
gesture = false;
assert.deepEqual(order, ["render", "background", "copy", "download", "cleanup"]);
const blob = await (await fetch(captured)).blob();
assert.equal(blob.type, "image/jpeg");
assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [255, 216, 255, 217]);
assert.equal(save.disabled, false);
assert.doesNotMatch(status.textContent, /저장했습니다/);
for (const badType of [false, true]) {
  order.length = 0;
  fail = !badType;
  encodedType = "image/png";
  save.onclick();
  assert.ok(!order.includes("download"), "Never download failed or mislabelled JPEG data");
  assert.equal(save.disabled, false);
  assert.match(status.textContent, /저장하지 못/);
}
assert.doesNotMatch(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), /save-preview/);
console.log("PASS: immediate JPEG download, matching MIME/extension, no preview, export size cap, encoding failure recovery.");
