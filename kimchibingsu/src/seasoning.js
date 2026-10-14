import * as THREE from "../vendor/three/three.module.js";

// Each round's recipe mix colors both the falling flakes and the settled shards.
export function createSeasoning(parent, radius, heightAt, normalAt, random) {
  const capacity = 48;
  let amount = capacity;
  let colors = [];
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.4,
    metalness: 0.16,
    flatShading: true,
  });
  const chips = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    material,
    capacity,
  );
  chips.count = 0;
  chips.frustumCulled = false;
  chips.receiveShadow = true;
  parent.add(chips);
  const positions = new Float32Array(Math.ceil(capacity / 10) * 3);
  const seeds = new Float32Array(positions.length / 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("sparkSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setDrawRange(0, 0);
  const sparkleMaterial = new THREE.ShaderMaterial({
    uniforms: { clock: { value: 0 }, pixelHeight: { value: 800 } },
    vertexShader: `attribute float sparkSeed; uniform float clock; uniform float pixelHeight; varying float brightness;
      void main(){ brightness=pow(max(0.0,sin(clock*2.4+sparkSeed)),24.0); vec4 p=modelViewMatrix*vec4(position,1.0);
      gl_Position=projectionMatrix*p; gl_PointSize=clamp(pixelHeight*.027/max(.5,-p.z),2.0,6.0); }`,
    fragmentShader: `varying float brightness; void main(){vec2 p=gl_PointCoord*2.0-1.0;
      float crossLight=exp(-abs(p.x)*22.0-p.y*p.y*4.0)+exp(-abs(p.y)*22.0-p.x*p.x*4.0);
      float a=brightness*crossLight*.65;if(a<.04)discard;gl_FragColor=vec4(1.0,.96,.76,a);}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sparkles = new THREE.Points(geometry, sparkleMaterial);
  sparkles.frustumCulled = false;
  parent.add(sparkles);
  const dummy = new THREE.Object3D();
  return {
    configure(palette, accentPalette, accentCount) {
      amount = 30 + Math.floor(random() * 19);
      const accents = Math.min(amount, accentCount);
      colors = Array.from({ length: amount }, (_, i) => i < accents
        ? accentPalette[i % accentPalette.length]
        : palette[(i - accents) % palette.length]);
      // Shuffle the fixed color counts independently of the spatial clusters.
      for (let i = colors.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [colors[i], colors[j]] = [colors[j], colors[i]];
      }
      const clusters = Array.from(
        { length: 2 + Math.floor(random() * 2) },
        () => {
          const a = random() * Math.PI * 2;
          const r = (0.15 + random() * 0.5) * radius;
          return {
            x: Math.cos(a) * r,
            z: Math.sin(a) * r,
            spread: radius * (0.06 + random() * 0.13),
          };
        },
      );
      for (let i = 0; i < amount; i++) {
        const cluster = clusters[
          Math.floor(Math.pow(random(), 1.7) * clusters.length)
        ];
        const a = random() * Math.PI * 2;
        const scattered = random() < 0.18;
        const r = Math.sqrt(random()) *
          (scattered ? radius * 0.9 : cluster.spread);
        let x = Math.cos(a) * r + (scattered ? 0 : cluster.x);
        let z = Math.sin(a) * r + (scattered ? 0 : cluster.z);
        const limit = Math.min(1, radius * 0.91 / Math.hypot(x, z));
        x *= limit;
        z *= limit;
        dummy.position.set(x, heightAt(x, z) + 0.019, z);
        dummy.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normalAt(x, z),
        );
        dummy.rotateY(random() * Math.PI * 2);
        const size = 0.55 + Math.pow(random(), 1.7) * 1.1;
        dummy.scale.set(
          (0.012 + random() * 0.009) * size,
          (0.004 + random() * 0.004) * size,
          (0.007 + random() * 0.01) * size,
        );
        dummy.updateMatrix();
        chips.setMatrixAt(i, dummy.matrix);
        chips.setColorAt(i, new THREE.Color(colors[i]));
        if (i % 10 === 0) {
          positions.set([x, dummy.position.y + 0.008, z], (i / 10) * 3);
          seeds[i / 10] = random() * Math.PI * 2;
        }
      }
      chips.instanceMatrix.needsUpdate = chips.instanceColor.needsUpdate = true;
      geometry.attributes.position.needsUpdate =
        geometry.attributes.sparkSeed.needsUpdate = true;
      chips.count = 0;
    },
    sampleColor() {
      return colors[Math.floor(random() * colors.length)];
    },
    update(progress, time, pixelHeight, tossing) {
      chips.count = Math.round(amount * progress);
      geometry.setDrawRange(0, Math.floor(chips.count / 10));
      sparkles.visible = !tossing;
      sparkleMaterial.uniforms.clock.value = time;
      sparkleMaterial.uniforms.pixelHeight.value = pixelHeight;
      return chips.count;
    },
  };
}
