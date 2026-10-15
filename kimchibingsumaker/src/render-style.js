// The GLBs already contain painted lighting. Add just a little warm direction
// inside their existing shader, without an extra render pass or texture lookup.
export function softenPaintedLighting(roots) {
  const styled = new Set();
  for (const root of roots) root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material.isMeshBasicMaterial || styled.has(material)) continue;
      styled.add(material);
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying float vPaintedLight;")
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            vec3 paintedNormal = normalize(mat3(modelMatrix) * normal);
            vPaintedLight = dot(paintedNormal, normalize(vec3(-0.3, 0.75, 0.6))) * 0.5 + 0.5;`);
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vPaintedLight;")
          .replace("#include <color_fragment>", `#include <color_fragment>
            diffuseColor.rgb *= mix(vec3(0.93, 0.95, 0.98), vec3(1.025, 1.005, 0.96), vPaintedLight);`);
      };
      material.customProgramCacheKey = () => "soft-painted-light-v1";
      material.needsUpdate = true;
    }
  });
}

export function renderPixelRatio(width, height) {
  // Keep small texture lettering legible while retaining fine pixel edges.
  // Cap large/Retina screens rather than multiplying work by devicePixelRatio.
  return Math.min(0.9, 1440 / Math.max(1, width), 900 / Math.max(1, height));
}
