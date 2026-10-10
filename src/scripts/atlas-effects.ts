import * as THREE from 'three';

/** Local activity above the roofline, readable at the default overview scale. */
export function createAtlasEffects(scene: THREE.Scene, camera: THREE.Camera) {
  type Effect = { group: THREE.Group; animate: (time: number) => void; name: string };
  const effects = new Map<string, Effect>();
  const cyan = 0x008f9e, mint = 0x56bc95, gold = 0xe0ac36;
  const material = (color = cyan, opacity = .9) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, toneMapped: false,
    side: THREE.DoubleSide,
  });
  function dot(group: THREE.Group, size = .12, color = cyan) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), material(color));
    group.add(mesh); return mesh;
  }
  // Mesh tubes have a real width; WebGL one-pixel lines disappear in an overview.
  function trail(group: THREE.Group, points: THREE.Vector3[], color = cyan, opacity = .7, radius = .045) {
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, radius, 6, false), material(color, opacity));
    group.add(mesh); return { mesh, curve };
  }
  function add(key: string, name: string, build: (group: THREE.Group) => Effect['animate']) {
    const group = new THREE.Group(); group.name = 'activity-' + key; group.visible = false;
    scene.add(group); effects.set(key, { group, name, animate: build(group) });
  }
  add('friends', 'signal-reception', group => {
    const rings = Array.from({ length: 3 }, () => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64), material(cyan));
      ring.position.set(15, 6.4, 3); group.add(ring); return ring;
    });
    const beacon = dot(group, .15, gold); beacon.position.set(15, 6.4, 3);
    const packets = [dot(group, .11), dot(group, .11)];
    return t => {
      rings.forEach((ring, i) => {
        const p = (t / 2.1 + i / 3) % 1;
        ring.quaternion.copy(camera.quaternion);
        ring.scale.setScalar(2.15 * (1 - p) + .15);
        (ring.material as THREE.MeshBasicMaterial).opacity = .85 * Math.sin(Math.PI * p);
      });
      beacon.scale.setScalar(.8 + .45 * Math.max(0, Math.sin(t * 6)));
      // Incoming packets descend along the mast; the western bridge stays static.
      packets.forEach((packet, i) => {
        const p = (t / 1.5 + i / 2) % 1;
        packet.position.set(15 + .45 * Math.cos(i * Math.PI), 6.15 - p * 3.9, 3.45);
        (packet.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * p);
      });
    };
  });
  add('skills', 'gantry-stitch', group => {
    trail(group, [new THREE.Vector3(-14.7, 4.23, -3.7), new THREE.Vector3(-9.4, 4.23, -3.7)], mint, .55);
    const shuttle = new THREE.Mesh(new THREE.BoxGeometry(.48, .23, .32), material(cyan)); group.add(shuttle);
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .85, 8), material(gold)); group.add(needle);
    const sparks = Array.from({ length: 4 }, () => dot(group, .085, gold));
    return t => {
      const x = -14.7 + (Math.sin(t * 1.9) + 1) / 2 * 5.3;
      shuttle.position.set(x, 4.23, -3.7); needle.position.set(x, 3.75, -3.5);
      sparks.forEach((spark, i) => {
        const p = (t * 1.4 + i / 4) % 1;
        spark.position.set(x + (i % 2 ? 1 : -1) * p * .35, 3.5 - p * .7, -3.35);
        spark.scale.setScalar(1 - p); (spark.material as THREE.MeshBasicMaterial).opacity = 1 - p;
      });
    };
  });
  add('works', 'drawing-stroke', group => {
    const points = Array.from({ length: 33 }, (_, i) => {
      const a = .18 + i / 32 * (Math.PI - .36);
      return new THREE.Vector3(13 - 2.4 * Math.cos(a), 1.5 + 1.74 * Math.sin(a) + .16, -8.15);
    });
    const stroke = trail(group, points, cyan, .85, .065), pen = dot(group, .16, gold);
    return t => {
      const p = (t / 2.8) % 1, progress = Math.min(1, p / .8);
      stroke.mesh.geometry.setDrawRange(0, Math.max(1, Math.floor(progress * 96)) * 36);
      pen.position.copy(stroke.curve.getPointAt(progress));
      const opacity = p < .8 ? .9 : .9 * (1 - (p - .8) / .2);
      (stroke.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
      (pen.material as THREE.MeshBasicMaterial).opacity = opacity;
    };
  });
  add('character', 'identity-orbit', group => {
    const points = Array.from({ length: 65 }, (_, i) => new THREE.Vector3(
      2.3 * Math.cos(i / 64 * Math.PI * 2), 3.4, .9 + 1.65 * Math.sin(i / 64 * Math.PI * 2),
    ));
    const orbit = trail(group, points, mint, .45);
    const glints = [dot(group, .15, cyan), dot(group, .12, gold)];
    return t => glints.forEach((glint, i) => glint.position.copy(orbit.curve.getPointAt((t / 3.5 + i / 2) % 1)));
  });
  add('timeline', 'clock-sweep', group => {
    const center = new THREE.Vector3(-11, 3.15, 10.2), radius = 1.13;
    trail(group, Array.from({ length: 65 }, (_, i) => center.clone().add(new THREE.Vector3(
      radius * Math.cos(i / 64 * Math.PI * 2), 0, radius * Math.sin(i / 64 * Math.PI * 2),
    ))), mint, .7);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(radius, .07, .095), material(cyan));
    const pivot = new THREE.Group(); pivot.position.copy(center); group.add(pivot);
    hand.position.x = radius / 2; pivot.add(hand);
    const tip = dot(pivot, .13, gold); tip.position.x = radius;
    return t => { pivot.rotation.y = -t * 1.4; };
  });
  add('recent', 'camp-fireflies', group => {
    const lights = Array.from({ length: 5 }, (_, i) => dot(group, .11, i % 2 ? mint : gold));
    return t => lights.forEach((light, i) => {
      const a = t * 1.1 + i * Math.PI * 2 / lights.length;
      light.position.set(3 + 2 * Math.cos(a), 3.35 + .32 * Math.sin(t * 2 + i), 13 + 1.1 * Math.sin(a));
      (light.material as THREE.MeshBasicMaterial).opacity = .55 + .4 * Math.sin(t * 2 + i) ** 2;
      light.scale.setScalar(.85 + .25 * Math.sin(t * 2 + i));
    });
  });
  add('about', 'seedling-lights', group => {
    const rows = [[0, -11.8], [-3.2, -15], [3.2, -15]];
    const lights = rows.map(() => dot(group, .16, gold));
    const ripples = rows.map(([x, z]) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.89, 1, 48), material(cyan));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 1.45, z); group.add(ring); return ring;
    });
    return t => lights.forEach((light, i) => {
      const p = (t / 2.4 + i / 3) % 1;
      light.position.set(rows[i][0] - 1.05 + p * 2.1, 1.65 + .22 * Math.sin(p * Math.PI), rows[i][1]);
      (light.material as THREE.MeshBasicMaterial).opacity = .9 * Math.sin(Math.PI * p);
      ripples[i].scale.setScalar(.2 + p * 1.05);
      (ripples[i].material as THREE.MeshBasicMaterial).opacity = .9 * Math.sin(Math.PI * p);
    });
  });
  let selected = '', start = 0;
  function select(key: string) {
    if (selected === key) return;
    const previous = effects.get(selected); if (previous) previous.group.visible = false;
    selected = effects.has(key) ? key : ''; start = performance.now() / 1000;
  }
  function update(now: number, motion: boolean) {
    const effect = effects.get(selected); if (!effect) return false;
    // Removing an active cue must also redraw once, including reduced-motion changes.
    const changed = effect.group.visible !== motion;
    effect.group.visible = motion;
    if (motion) effect.animate(Math.max(0, now - start));
    return motion || changed;
  }
  return { select, update, name: () => effects.get(selected)?.name ?? '' };
}
