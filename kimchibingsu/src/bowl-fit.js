import * as THREE from "../vendor/three/three.module.js";

// Seat the ice below the decorative lip instead of coating the bowl's sides.
export function measureBowlRim(bowl, height) {
  bowl.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const samples = [];
  for (let i = 0; i < 128; i++) {
    const angle = i / 128 * Math.PI * 2;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    let low = height * 0.65, high = height + 0.01;
    for (let step = 0; step < 13; step++) {
      const y = (low + high) / 2;
      ray.set(new THREE.Vector3(0, y, 0), direction);
      if (ray.intersectObject(bowl, true).length) low = y;
      else high = y;
    }
    const y = low - 0.065;
    ray.set(new THREE.Vector3(0, y, 0), direction);
    const hit = ray.intersectObject(bowl, true)[0];
    if (!hit) throw new Error("Cannot fit ice to the bowl's inner rim.");
    samples.push({ radius: hit.distance - 0.014, height: y });
  }
  return samples;
}

export function rimAt(samples, angle) {
  const unit = (angle / (Math.PI * 2) + 1) % 1 * samples.length;
  const i = Math.floor(unit), t = unit - i;
  const a = samples[i], b = samples[(i + 1) % samples.length];
  return {
    radius: THREE.MathUtils.lerp(a.radius, b.radius, t),
    height: THREE.MathUtils.lerp(a.height, b.height, t),
  };
}
