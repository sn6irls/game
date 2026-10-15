import * as THREE from "../vendor/three/three.module.js";

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
      desk.scale.copy(deskScale);
      if (mobile) {
        desk.scale.x *= 1.08;
        desk.scale.z *= 1.08;
      }
    },
    update(camera) {
      // Reveal a little of the comic at the left edge of a narrow screen.
      shiftedAnchor.x = anchor.x + (mobile ? 0.35 : 0);
      shiftedAnchor.y = anchor.y - (mobile ? 0.45 : 4.6);
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
      const scale = 1.10 * Math.max(mobile ? 0.94 : 1.25,
        (-1.03 - shifted.x) / minX, (1.03 - shifted.x) / maxX,
        (-1.03 - shifted.y) / minY, (1.03 - shifted.y) / maxY);
      backdrop.scale.copy(restScale).multiplyScalar(scale);
      backdrop.position.copy(restPosition).sub(localAnchor)
        .multiplyScalar(scale).add(localAnchor).add(localShift);
    },
  };
}
