import * as THREE from "../vendor/three/three.module.js";

// Extend only the empty wall/floor strips at the sides. Keep the calendar,
// furniture and floor props at their original proportions on wide screens.
function widenBackdrop(source) {
  const positions = source.getAttribute("position"), uvs = source.getAttribute("uv");
  const normals = source.getAttribute("normal");
  const vertices = [], textureCoords = [], directions = [], indices = [];
  const sourceIndex = Array.from(source.index.array);
  function span(left, right, uvLeft, uvRight) {
    const first = vertices.length / 3;
    for (let row = 0; row < 2; row++) {
      const a = row * 2, b = a + 1;
      for (const [x, u] of [[left, uvLeft], [right, uvRight]]) {
        for (let axis = 0; axis < 3; axis++) {
          vertices.push(THREE.MathUtils.lerp(positions.array[a * 3 + axis], positions.array[b * 3 + axis], x));
          directions.push(normals.array[a * 3 + axis]);
        }
        textureCoords.push(THREE.MathUtils.lerp(uvs.getX(a), uvs.getX(b), u), uvs.getY(a));
      }
    }
    indices.push(...sourceIndex.map((i) => first + i));
  }
  span(0, 1, 0, 1);
  const strip = 0.008;
  for (let i = 0; i < 200; i++) {
    const a = i % 2 ? 0 : strip, b = strip - a;
    span(-(i + 1) * strip, -i * strip, a, b);
    span(1 + i * strip, 1 + (i + 1) * strip, 1 - b, 1 - a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(directions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(textureCoords, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

// desk.glb and plane.glb share the artist's Blender scene coordinates.
export function createRoom(scene, room) {
  room.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = object.name === "desk";
    object.receiveShadow = false;
  });
  scene.add(room);
  room.updateMatrixWorld(true);
  const backdrop = room.getObjectByName("Plane002");
  const bounds = new THREE.Box3().setFromObject(backdrop);
  const depth = (bounds.min.z + bounds.max.z) / 2;
  const originalGeometry = backdrop.geometry;
  const wideGeometry = widenBackdrop(originalGeometry);
  const floorAnchor = new THREE.Vector3(0, bounds.max.y - (bounds.max.y - bounds.min.y) * 0.58, depth);
  const localFloorAnchor = backdrop.parent.worldToLocal(floorAnchor.clone());
  // Scale around the floor props so enlarging the room does not crop the books.
  const anchor = new THREE.Vector3(0, -2.5, depth);
  const shiftedAnchor = anchor.clone().add(new THREE.Vector3(0, -0.45, 0));
  const localAnchor = backdrop.parent.worldToLocal(anchor.clone());
  const localShift = backdrop.parent.worldToLocal(shiftedAnchor.clone()).sub(localAnchor);
  const restPosition = backdrop.position.clone(), restScale = backdrop.scale.clone();
  const corners = [
    new THREE.Vector3(bounds.min.x, bounds.min.y, depth),
    new THREE.Vector3(bounds.max.x, bounds.min.y, depth),
    new THREE.Vector3(bounds.min.x, bounds.max.y, depth),
    new THREE.Vector3(bounds.max.x, bounds.max.y, depth),
  ];
  const origin = new THREE.Vector3(), shifted = new THREE.Vector3(), point = new THREE.Vector3();
  const desk = room.getObjectByName("desk"), deskScale = desk.scale.clone();
  let mobile = false;
  return {
    resize(width, coarsePointer = false) {
      mobile = width <= 700 || coarsePointer;
      backdrop.geometry = mobile ? originalGeometry : wideGeometry;
      desk.scale.copy(deskScale);
      if (mobile) {
        desk.scale.x *= 1.08;
        desk.scale.z *= 1.08;
      }
    },
    update(camera) {
      if (!mobile) {
        // Keep the wall/floor join at 71% of the screen instead of cropping the
        // floor to cover the width. Side strips fill the extra horizontal space.
        const upY = Math.max(0.25, camera.matrixWorldInverse.elements[5]);
        const frame = camera.top - camera.bottom;
        const scale = frame / (10.0 * upY);
        origin.copy(floorAnchor).project(camera);
        shiftedAnchor.copy(floorAnchor);
        shiftedAnchor.y += (-0.42 - origin.y) * frame / (2 * upY);
        localShift.copy(shiftedAnchor);
        backdrop.parent.worldToLocal(localShift).sub(localFloorAnchor);
        backdrop.scale.copy(restScale).multiplyScalar(scale);
        backdrop.position.copy(restPosition).sub(localFloorAnchor)
          .multiplyScalar(scale).add(localFloorAnchor).add(localShift);
        return;
      }
      // Reveal a little of the comic at the left edge of a narrow screen.
      shiftedAnchor.x = anchor.x + 0.35;
      shiftedAnchor.y = anchor.y - 0.45;
      localShift.copy(shiftedAnchor);
      backdrop.parent.worldToLocal(localShift).sub(localAnchor);
      origin.copy(anchor).project(camera);
      shifted.copy(shiftedAnchor).project(camera);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const corner of corners) {
        point.copy(corner).project(camera).sub(origin);
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      }
      // Cover the viewport with the actual image, uniformly scaled. The margin
      // accommodates the breathing camera without stretching its edge pixels.
      const scale = 1.10 * Math.max(0.94,
        (-1.03 - shifted.x) / minX, (1.03 - shifted.x) / maxX,
        (-1.03 - shifted.y) / minY, (1.03 - shifted.y) / maxY);
      backdrop.scale.copy(restScale).multiplyScalar(scale);
      backdrop.position.copy(restPosition).sub(localAnchor)
        .multiplyScalar(scale).add(localAnchor).add(localShift);
    },
  };
}
