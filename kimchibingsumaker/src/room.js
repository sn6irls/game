import * as THREE from "../vendor/three/three.module.js";

// desk.glb and plane.glb share the artist's Blender scene coordinates.
export function createRoom(scene, room) {
  room.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = object.name === 'desk';
    // Preserve the painted lighting, including the TV, fan and floor props.
    object.receiveShadow = false;
  });
  const backdrop = room.getObjectByName("Plane002");
  // Continue only the outermost painted pixels beyond the original backdrop.
  // This fills wide screens without stretching or repositioning the room art.
  const fill = backdrop.clone();
  fill.name = "RoomBackdropOverflow";
  fill.geometry = backdrop.geometry.clone();
  fill.geometry.computeBoundingBox();
  const center = fill.geometry.boundingBox.getCenter(new THREE.Vector3());
  fill.geometry.translate(-center.x, -center.y, -center.z);
  fill.geometry.scale(12, 12, 12);
  fill.geometry.translate(center.x, center.y, center.z);
  const uv = fill.geometry.getAttribute("uv");
  let uCenter = 0, vCenter = 0;
  for (let i = 0; i < uv.count; i++) {
    uCenter += uv.getX(i) / uv.count;
    vCenter += uv.getY(i) / uv.count;
  }
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (uv.getX(i) - uCenter) * 12 + uCenter, (uv.getY(i) - vCenter) * 12 + vCenter);
  fill.material = backdrop.material.clone();
  fill.material.map = backdrop.material.map.clone();
  fill.material.map.wrapS = fill.material.map.wrapT = THREE.ClampToEdgeWrapping;
  fill.material.map.needsUpdate = true;
  fill.position.z -= 0.002;
  backdrop.parent.add(fill);
  scene.add(room);

  // Keep the machine and bowl framing; only pull the room art back on phones.
  backdrop.updateMatrix();
  backdrop.geometry.computeBoundingBox();
  const artCenter = backdrop.geometry.boundingBox.getCenter(new THREE.Vector3())
    .applyMatrix4(backdrop.matrix);
  const anchor = new THREE.Vector3(0, 0, artCenter.z);
  const art = [backdrop, fill].map((object) => ({
    object,
    position: object.position.clone(),
    scale: object.scale.clone(),
  }));
  const desk = room.getObjectByName("desk");
  const deskScale = desk.scale.clone();
  return (width, coarsePointer = false) => {
    const mobile = width <= 700 || coarsePointer;
    const distanceScale = mobile ? 0.94 : 1;
    for (const item of art) {
      item.object.scale.copy(item.scale).multiplyScalar(distanceScale);
      item.object.position.copy(item.position).sub(anchor)
        .multiplyScalar(distanceScale).add(anchor);
    }
    // Widen the tabletop without lifting its surface or the machine on it.
    desk.scale.copy(deskScale);
    if (mobile) {
      desk.scale.x *= 1.08;
      desk.scale.z *= 1.08;
    }
  };
}
