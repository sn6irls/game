import assert from "node:assert/strict";
import { installImageSave } from "../src/save-image.js";

// Simulate browsers with no file sharing and ones requiring a fresh user tap.
class Element {
  hidden = true;
  disabled = false;
  listeners = {};
  addEventListener(name, fn) { this.listeners[name] = fn; }
  removeAttribute(name) { delete this[name]; }
  setAttribute(name, value) { this[name] = value; }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.close(); }
  focus() { this.focused = true; }
}
const png = new Blob([Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4S8AAAAASUVORK5CYII=",
  "base64")], { type: "image/png" });
globalThis.FileReader = class {
  async readAsDataURL(blob) {
    this.result = `data:image/png;base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
    this.onload();
  }
};
// Do not retain the URL cleanup timer for a minute in this test process.
const nativeTimeout = globalThis.setTimeout;
globalThis.setTimeout = (...args) => nativeTimeout(...args).unref();

function setup(nav = {}) {
  const elements = Object.fromEntries([
    "save", "save-preview", "save-image", "save-share", "save-download", "save-status", "save-close",
  ].map(id => [id, new Element()]));
  const order = [];
  let completePNG;
  const output = {
    getContext: () => ({ drawImage: () => order.push("copy") }),
    toBlob: resolve => { completePNG = resolve; },
  };
  globalThis.document = {
    getElementById: id => elements[id],
    createElement: () => output,
  };
  globalThis.window = { devicePixelRatio: 3 };
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });
  installImageSave({
    canvas: { clientWidth: 1080, clientHeight: 1920 },
    render: () => order.push("render"),
    filename: () => "kimchi-ice-1.png",
  });
  return {
    e: elements, order, output,
    begin: () => elements.save.onclick(),
    complete: (blob = png) => completePNG(blob),
  };
}

let activation = false, shared = 0;
let t = setup({
  canShare: ({ files }) => files[0].type === "image/png",
  share: ({ files }) => {
    assert.equal(activation, true, "Sharing must use its own fresh tap");
    assert.equal(files[0].name, "kimchi-ice-1.png");
    shared++;
    return Promise.resolve();
  },
});
let pending = t.begin();
assert.deepEqual(t.order, ["render", "copy"]);
assert.equal(t.output.height, 2048, "Cap export memory on high-DPI phones");
assert.equal(shared, 0);
t.complete();
await pending;
assert.equal(shared, 0, "PNG encoding must not auto-invoke sharing");
assert.equal(t.e["save-share"].hidden, false);
assert.match(t.e["save-image"].src, /^data:image\/png;base64,/);
activation = true;
pending = t.e["save-share"].onclick();
activation = false;
await pending;
assert.equal(shared, 1);
t.e["save-close"].onclick();
assert.equal(t.e.save.disabled, false);
assert.equal(t.e["save-image"].src, undefined);

for (const name of ["NotAllowedError", "AbortError", "DataError"]) {
  t = setup({ canShare: () => true, share: () => Promise.reject({ name }) });
  pending = t.begin(); t.complete(); await pending;
  await t.e["save-share"].onclick();
  assert.equal(t.e["save-image"].hidden, false);
  assert.equal(t.e["save-download"].hidden, false);
  assert.equal(t.e["save-share"].disabled, false);
  assert.match(t.e["save-status"].textContent, /길게/);
  t.e["save-close"].onclick();
}

for (const nav of [{}, { canShare: () => false }, { canShare: () => { throw Error(); }, share() {} }]) {
  t = setup(nav);
  pending = t.begin(); t.complete(); await pending;
  assert.equal(t.e["save-share"].hidden, true);
  assert.equal(t.e["save-image"].hidden, false);
  assert.match(t.e["save-download"].href, /^blob:/);
  t.e["save-download"].onclick();
  assert.doesNotMatch(t.e["save-status"].textContent, /저장했습니다/);
  t.e["save-close"].onclick();
}

t = setup();
pending = t.begin();
t.e["save-close"].onclick();
t.complete(); await pending;
assert.equal(t.e["save-image"].src, undefined, "Closing during encoding cannot restore stale data");
pending = t.begin(); t.complete(null); await pending;
assert.match(t.e["save-status"].textContent, /만들지 못/);
assert.equal(t.e.save.disabled, false);
assert.equal(t.e["save-download"].hidden, true);
console.log("PASS: fresh share gesture, rejected/cancelled shares, unsupported webviews, PNG failure, close during encoding, bounded export size.");
