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
}
