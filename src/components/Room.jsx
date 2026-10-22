import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox, useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BADGES, SECTIONS } from '../data';
import { nowIST, ui } from '../ui';
import { blip } from '../sound';
import { audio } from '../audio';

/* ================= layout =================
   Everything a section docks onto is described once here, so the camera,
   the 3D prop and the HTML surface laid over it always agree. */

// Positions and sizes below were measured from the reference: its default view was
// calibrated (camera fitted to the wall, window and pegboard, ~9 px error) and each
// object's pixels back-projected into this room.
const DESK = { pos: [-2.03, 0, -2.24], rotY: 0, w: 3.0, d: 1.06 };
const MONITOR = { pos: [-2.0, 0.8, -2.0], rotY: 0, W: 0.9, H: 0.6, D: 0.12 };
const ROBOT = { pos: [-1.75, 0, -3.0], rotY: 0, headY: 1.4285 }; // headY = the J table's head centre
// An iPhone 14 Plus, life size: 78.1 x 160.8 x 7.8 mm, 6.7" screen. Lies on the desk.
const IPHONE = { w: 0.0781, h: 0.1608, t: 0.0078, r: 0.0122, sw: 0.0718, sh: 0.1545, bump: 0.0018 };
// Drawn 1.6x life size, so it reads from across the room the way the reference's phone does.
const PHONE = { scale: 1.9, rotY: -0.55, tilt: -Math.PI / 2 };
PHONE.pos = [-0.91, 0.8 + (IPHONE.t / 2 + IPHONE.bump) * PHONE.scale, -2.04];
// The monitor's recessed screen, inside its chamfered bezel.
const SCREEN = { w: 0.76, h: 0.42, y: 0.572, recess: 0.045 };
const BOARD = { pos: [0.36, 2.03, -4.47], w: 1.72, h: 0.75 };
const CABINET = { pos: [0.15, 0, -4.225], w: 1.1, h: 0.58, d: 0.55 };
const SPEAKER = { pos: [-0.16, 0.58 + 0.245, -4.2], w: 0.35, h: 0.49, d: 0.3 };
const WINDOW = { x0: -3.79, x1: -0.69, y0: 1.32, y1: 3.3 };

// Where badge i hangs: its x on the board, its lanyard length, and its card's centre in the room.
const BOARD_W = 2.1;
const BOARD_H = 0.9;
const badgeLocal = (i) => ({ x: -BOARD_W / 2 + 0.2 + i * 0.235, len: 0.32 + ((i * 37) % 5) * 0.025, top: BOARD_H / 2 - 0.05 });
function badgeWorld(i) {
  const { x, len, top } = badgeLocal(i);
  const sx = BOARD.w / BOARD_W;
  const sy = BOARD.h / BOARD_H;
  return new THREE.Vector3(BOARD.pos[0] + x * sx, BOARD.pos[1] + (top - 0.03 - len - 0.115) * sy, BOARD.pos[2] + 0.2);
}

function surfaceSpec(pos, rotY, tilt, local, w, h) {
  const o = new THREE.Object3D();
  o.position.set(...pos);
  o.rotation.set(tilt, rotY, 0, 'YXZ');
  o.updateMatrixWorld();
  return {
    c: new THREE.Vector3(...local).applyMatrix4(o.matrixWorld),
    n: new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld),
    right: new THREE.Vector3(1, 0, 0).transformDirection(o.matrixWorld),
    up: new THREE.Vector3(0, 1, 0).transformDirection(o.matrixWorld),
    w,
    h,
  };
}

const SURFACES = {
  projects: surfaceSpec(MONITOR.pos, MONITOR.rotY, 0, [0, SCREEN.y, -SCREEN.recess + 0.0015], SCREEN.w, SCREEN.h),
  experience: surfaceSpec(badgeWorld(0).toArray(), 0, 0, [0, 0, 0], 0.62, 0.4), // framed on the badge in front
  about: surfaceSpec(ROBOT.pos, ROBOT.rotY, 0, [0, ROBOT.headY, 0.1555], 0.33, 0.238),
  contact: surfaceSpec(PHONE.pos, PHONE.rotY, PHONE.tilt, [0, 0, (IPHONE.t / 2 + 0.0004) * PHONE.scale], IPHONE.sw * PHONE.scale, IPHONE.sh * PHONE.scale),
  music: surfaceSpec(SPEAKER.pos, 0, 0, [0, 0, SPEAKER.d / 2 + 0.001], SPEAKER.w, SPEAKER.h),
};

// Surface font size = its on-screen width / this, so the HTML scales with the prop.
const FONT_SCALE = { projects: 58, experience: 40, about: 21, contact: 20, music: 17 };

const TITLES = { projects: 'Open projects', experience: 'Experience', about: 'Talk to me', contact: 'Contact', music: 'Now playing' };

/* ================= camera =================
   The reference's camera, rebuilt: a 32° lens orbiting the room from outside it (the
   dollhouse view), fitted so every marker clears the screen's edges; dragging eases the
   orbit 8% a frame. Docking fits the prop to 86% of the band between the top buttons and
   the index, and flies there in 1.6 s on a smootherstep, arcing round the prop (its
   direction slerps, its distance eases), turning to face it by 62% of the way, the up and
   the lens blending as it goes. Leaving runs the same flight backwards. */

export const FOV = 32;
const DOCK_TIME = 1.6;
const INTRO_DELAY = 0.9;
const INTRO_TIME = 2.6;
const pointer = { down: false, moved: 0, x: 0, y: 0 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const smoothstep = (t, a = 0, b = 1) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const deg = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const MARKERS = {
  projects: [MONITOR.pos[0], 1.86, MONITOR.pos[2]],
  about: [ROBOT.pos[0], 2.08, ROBOT.pos[2]],
  contact: [PHONE.pos[0], 1.08, PHONE.pos[2]],
  experience: [BOARD.pos[0], BOARD.pos[1] + BOARD.h / 2 + 0.2, BOARD.pos[2] + 0.12],
  music: [SPEAKER.pos[0], SPEAKER.pos[1] + SPEAKER.h / 2 + 0.17, SPEAKER.pos[2] + 0.05],
};

// What the room view must keep on screen: the markers, and the desk.
const FIT_POINTS = (() => {
  const pts = Object.values(MARKERS).map((m) => new THREE.Vector3(...m));
  const o = new THREE.Object3D();
  o.position.set(...DESK.pos);
  o.rotation.y = DESK.rotY;
  o.updateMatrixWorld();
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const y of [0, 0.8]) pts.push(new THREE.Vector3((x * DESK.w) / 2, y, (z * DESK.d) / 2).applyMatrix4(o.matrixWorld));
  return pts;
})();

const orbit = { yaw: 0.95, pitch: 0.3, dist: 9, target: new THREE.Vector3(-1.2, 1.0, -2.4), goalYaw: 0.95, goalPitch: 0.3 };
const orbitPos = (o, out) =>
  out.set(o.target.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, o.target.y + Math.sin(o.pitch) * o.dist, o.target.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);

// Fit the orbit like the reference: every point inside x ±(1 − 32/W), top 1 − 128/H,
// bottom −1 + 32/H (176/H on phones); binary-search the distance, re-centre, three times.
function fitOrbit(W, H) {
  const m = { x: 1 - 32 / W, top: 1 - 128 / H, bottom: -1 + (2 * (W <= 700 ? 88 : 16)) / H };
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 200);
  const v = new THREE.Vector3();
  const bounds = (d) => {
    orbit.dist = d;
    orbitPos({ ...orbit, yaw: 0.95, pitch: 0.3 }, cam.position);
    cam.lookAt(orbit.target);
    cam.updateMatrixWorld();
    let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity;
    for (const p of FIT_POINTS) {
      v.copy(p).project(cam);
      l = Math.min(l, v.x); r = Math.max(r, v.x); b = Math.min(b, v.y); t = Math.max(t, v.y);
    }
    return { l, r, b, t };
  };
  const fits = (d) => {
    const s = bounds(d);
    return s.l > -m.x && s.r < m.x && s.b > m.bottom && s.t < m.top;
  };
  const search = () => {
    let lo = 1, hi = 60;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    orbit.dist = hi;
  };
  const ux = new THREE.Vector3();
  const uy = new THREE.Vector3();
  for (let k = 0; k < 3; k++) {
    search();
    const s = bounds(orbit.dist);
    const h = orbit.dist * Math.tan(rad(FOV / 2));
    ux.setFromMatrixColumn(cam.matrixWorld, 0);
    uy.setFromMatrixColumn(cam.matrixWorld, 1);
    orbit.target.addScaledVector(ux, ((s.l + s.r) / 2) * h * (W / H));
    orbit.target.addScaledVector(uy, ((s.b + s.t) / 2 - (m.top + m.bottom) / 2) * h);
  }
  search();
}

// The view docked on a prop: it fills 86% of the band between the top buttons and the index.
function dockFit(spec, W, H, zoom = 1) {
  const top = 70;
  const bottom = H - (W <= 760 ? 84 : 74);
  const a = (bottom - top) / H;
  const s = Math.max(spec.h / Math.min(0.86, a * 0.97), spec.w / (W / H) / 0.86) / zoom;
  const c = Math.max(s / 2 / Math.tan(rad(FOV / 2)), 0.12);
  const fov = deg(2 * Math.atan(s / 2 / c));
  const l = ((top + bottom) / 2 - H / 2) / H;
  const look = spec.c.clone().addScaledVector(spec.up, l * s);
  return { pos: look.clone().addScaledVector(spec.n, c), look, up: spec.up.clone(), fov };
}

// A flight from a start to a dock: the reference's arc round the dock's look point.
function makeFlight(start, goal, special) {
  const center = goal.look;
  const c0 = start.pos.clone().sub(center);
  const l0 = goal.pos.clone().sub(center);
  const u = c0.length();
  const d = l0.length();
  const q = new THREE.Quaternion().setFromUnitVectors(c0.clone().normalize(), l0.clone().normalize());
  const iq = new THREE.Quaternion();
  const path = special
    ? new THREE.CatmullRomCurve3([start.pos.clone(), ...special(goal), goal.pos.clone()], false, 'centripetal')
    : null;
  const tmp = new THREE.Quaternion();
  return {
    start,
    goal,
    pos(n, out) {
      if (path) return out.copy(path.getPointAt(n));
      tmp.copy(iq).slerp(q, n);
      return out.copy(c0).normalize().applyQuaternion(tmp).multiplyScalar(u + (d - u) * smoothstep(n)).add(center);
    },
  };
}

// The monitor is approached the long way: up over it, down to its back, round its side, in.
const projectsPath = () => {
  const { c, n, right } = SURFACES.projects;
  return [
    c.clone().addScaledVector(n, -1.2).addScaledVector(right, -0.15).addScaledVector(WORLD_UP, 0.95),
    c.clone().addScaledVector(right, 1.25).addScaledVector(n, 0.55).addScaledVector(WORLD_UP, 0.35),
  ];
};

const pan = new THREE.Vector3();
const PAN_ZERO = new THREE.Vector3();

function CameraRig({ target, onArrive, onExplore }) {
  const { camera, size, gl } = useThree();
  const rig = useRef(null);

  useEffect(() => {
    fitOrbit(size.width, size.height);
  }, [size.width, size.height]);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e) => {
      pointer.down = true;
      pointer.moved = 0;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const move = (e) => {
      if (!pointer.down) return;
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      if (rig.current?.key !== null || rig.current?.j > 0) return; // only look around in the room view
      // the right wall bounds the yaw, the way the reference keeps its camera inside its walls
      const maxYaw = Math.min(1.5, Math.asin(clamp((5.3 - orbit.target.x) / (Math.cos(orbit.goalPitch) * orbit.dist), -1, 1)));
      orbit.goalYaw = clamp(orbit.goalYaw - dx * 0.004, -0.3, Math.max(0.95, maxYaw));
      orbit.goalPitch = clamp(orbit.goalPitch + dy * 0.003, 0.08, 0.7);
      if (pointer.moved > 6) {
        ui.set({ drag: true });
        onExplore();
      }
    };
    const up = () => {
      pointer.down = false;
      ui.set({ drag: false });
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl, onExplore]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const W = size.width;
    const H = size.height;
    const k = 1 - Math.pow(0.92, dt * 60); // the reference's 8% a frame, at any frame rate
    orbit.yaw += (orbit.goalYaw - orbit.yaw) * k;
    orbit.pitch += (orbit.goalPitch - orbit.pitch) * k;
    const roomPos = orbitPos(orbit, new THREE.Vector3());

    if (!rig.current) rig.current = { key: undefined, j: 0, flight: null, intro: null, arrived: false, dockKey: null };
    const r = rig.current;

    if (r.key !== target) {
      const prev = r.key;
      r.key = target;
      r.arrived = false;
      onArrive(false);
      if (target === 'intro') {
        r.intro = { face: dockFit(SURFACES.about, W, H, 1.35), t: -1 }; // up against the face: it fills the screen
        r.j = 0;
      } else if (prev === 'intro' && target === null) {
        r.intro.t = -INTRO_DELAY; // hold on the face, then fly out
      } else if (target) {
        // into a dock: from the room, or from the dock we're on
        const goal = dockFit(SURFACES[target], W, H);
        const start = prev && r.flight && r.j > 0
          ? { pos: camera.position.clone(), look: r.flight.goal.look.clone(), up: r.flight.goal.up.clone(), fov: camera.fov }
          : { pos: roomPos.clone(), look: orbit.target.clone(), up: WORLD_UP.clone(), fov: FOV };
        r.flight = makeFlight(start, goal, null);
        r.flight.time = DOCK_TIME;
        r.j = 0;
        r.dockKey = target;
      } else if (r.flight) {
        // back to the room: the flight into this dock, from where the orbit is now, run backwards
        r.flight = makeFlight({ pos: roomPos.clone(), look: orbit.target.clone(), up: WORLD_UP.clone(), fov: FOV }, r.flight.goal, null);
        r.flight.time = DOCK_TIME;
      }
    }

    // the intro: on the robot's face, then out along a spline to the room view
    if (r.intro && (target === 'intro' || r.intro.t < INTRO_TIME)) {
      const f = r.intro.face;
      if (target !== 'intro') r.intro.t += dt;
      const p = clamp(r.intro.t / INTRO_TIME, 0, 1);
      const y = easeInOutCubic(p);
      // straight back out of the face, rising a little; then out and up to the room view,
      // swinging toward where the room camera sits, eyes moving from the face to the room
      const { n, right } = SURFACES.about;
      const side = Math.sign(roomPos.clone().sub(f.look).dot(right)) || 1;
      const pts = [
        f.pos,
        // back and up, clearing the top of the monitor in front of the robot
        f.look.clone().addScaledVector(n, 0.55).setY(MONITOR.pos[1] + SCREEN.y + MONITOR.H / 2 + 0.3),
        f.look.clone().addScaledVector(n, 2.8).addScaledVector(right, side * 1.1).setY(f.look.y + 1.05),
        roomPos,
      ];
      new THREE.CatmullRomCurve3(pts, false, 'centripetal').getPoint(y, camera.position);
      const look = f.look.clone().lerp(orbit.target, smoothstep(y, 0.2, 0.85));
      camera.up.copy(WORLD_UP);
      camera.lookAt(look);
      const fov = f.fov + (FOV - f.fov) * smoothstep(y, 0, 0.5);
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
      if (p >= 1) r.intro = null;
      return;
    }

    // dock progress: up to 1 while a dock is chosen, back down to 0 when it's let go
    if (r.flight) {
      r.j = clamp(r.j + ((target ? 1 : -1) * dt) / (r.flight.time || DOCK_TIME), 0, 1);
      if (!target && r.j === 0) r.flight = null;
    }

    // on the board, the camera slides along to whichever badge is in front
    const panGoal = target === 'experience' ? badgeWorld(ui.badge).sub(badgeWorld(0)) : PAN_ZERO;
    pan.lerp(panGoal, 1 - Math.exp(-dt * 5));

    if (r.flight && r.j > 0) {
      const n = smootherstep(r.j);
      const { start, goal } = r.flight;
      r.flight.pos(n, camera.position);
      const look = start.look.clone().lerp(goal.look, Math.min(1, n * 1.6));
      if (r.dockKey === 'experience') {
        camera.position.addScaledVector(pan, n);
        look.addScaledVector(pan, n);
      }
      camera.up.copy(start.up).lerp(goal.up, n).normalize();
      camera.lookAt(look);
      const fov = start.fov + (goal.fov - start.fov) * n;
      if (Math.abs(camera.fov - fov) > 1e-4) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      if (target && r.j === 1 && !r.arrived) {
        r.arrived = true;
        onArrive(true);
      }
    } else {
      camera.position.copy(roomPos);
      camera.up.copy(WORLD_UP);
      camera.lookAt(orbit.target);
      if (camera.fov !== FOV) {
        camera.fov = FOV;
        camera.updateProjectionMatrix();
      }
    }
    camera.updateMatrixWorld();
  });

  return null;
}

// Lays the open section's HTML exactly over its prop, every frame.
const corner = new THREE.Vector3();
function SurfacePlacer({ station, sheet, surfaces }) {
  const { camera, gl } = useThree();
  useFrame(() => {
    if (!station || sheet) return;
    const el = surfaces.current[station];
    if (!el) return;
    const s = SURFACES[station];
    // the canvas's real on-screen size, which is what the projected image fills
    const W = gl.domElement.clientWidth;
    const H = gl.domElement.clientHeight;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      corner.copy(s.c).addScaledVector(s.right, (a * s.w) / 2).addScaledVector(s.up, (b * s.h) / 2).project(camera);
      const x = ((corner.x + 1) / 2) * W;
      const y = ((1 - corner.y) / 2) * H;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const w = x1 - x0;
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    el.style.width = `${w}px`;
    el.style.height = `${y1 - y0}px`;
    el.style.fontSize = `${w / FONT_SCALE[station]}px`;
  });
  return null;
}

/* ================= textures ================= */

function useCanvas(w, h, draw, deps = []) {
  const [canvas, tex] = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return [c, t];
  }, [w, h]);
  const redraw = useMemo(
    () => (...args) => {
      draw(canvas.getContext('2d'), w, h, ...args);
      tex.needsUpdate = true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvas, tex, ...deps],
  );
  useEffect(() => {
    redraw();
    document.fonts?.ready.then(() => redraw()); // canvas text needs the web fonts
  }, [redraw]);
  return [tex, redraw];
}

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function drawPanels(g, w, h) {
  g.fillStyle = '#2a2932';
  g.fillRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.025)');
  grad.addColorStop(1, 'rgba(0,0,0,0.05)');
  g.fillStyle = grad;
  g.fillRect(4, 4, w - 8, h - 8);
  g.strokeStyle = '#1a1920';
  g.lineWidth = 6;
  g.strokeRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.04)';
  g.lineWidth = 2;
  g.strokeRect(5, 5, w - 10, h - 10);
}

function drawHerringbone(g, w, h) {
  g.fillStyle = '#211c1b';
  g.fillRect(0, 0, w, h);
  const rnd = seeded(23);
  const L = 128, W = 32;
  g.lineWidth = 2;
  for (let row = -2; row < h / W + 4; row++) {
    for (let col = -2; col < w / L + 4; col++) {
      for (const dir of [0, 1]) {
        g.save();
        const x = col * L + (dir ? W : 0) + row * W;
        const y = row * W - col * 0;
        g.translate(x, y);
        g.rotate(dir ? Math.PI / 4 : -Math.PI / 4);
        const l = 22 + rnd() * 14;
        g.fillStyle = `hsl(18, 10%, ${l * 0.55}%)`;
        g.fillRect(0, 0, L * 0.7, W * 0.7);
        g.strokeStyle = '#141110';
        g.strokeRect(0, 0, L * 0.7, W * 0.7);
        g.restore();
      }
    }
  }
}

function drawSunPatch(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.save();
  g.filter = 'blur(10px)';
  g.fillStyle = 'rgba(255,190,130,0.9)';
  g.beginPath();
  g.moveTo(w * 0.18, h * 0.12);
  g.lineTo(w * 0.86, h * 0.06);
  g.lineTo(w * 0.94, h * 0.9);
  g.lineTo(w * 0.1, h * 0.94);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fillRect(w * 0.5, 0, w * 0.035, h); // the window's mullion
  g.restore();
}

function drawSky(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#3d3361');
  sky.addColorStop(0.45, '#9a6688');
  sky.addColorStop(0.8, '#e39a86');
  sky.addColorStop(1, '#f5c18a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const sun = g.createRadialGradient(w * 0.7, h * 0.78, 10, w * 0.7, h * 0.78, 260);
  sun.addColorStop(0, 'rgba(255,230,180,0.9)');
  sun.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);
}

// A facade tile (8 m square): `glow` draws only the lit windows, for the emissive map.
function drawFacade(g, w, h, glow) {
  g.fillStyle = glow ? '#000' : '#d6cdd2';
  g.fillRect(0, 0, w, h);
  const rnd = seeded(77);
  const cw = w / 8;
  const ch = h / 10;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 8; c++) {
      const lit = rnd() < 0.38;
      if (glow && !lit) continue;
      g.fillStyle = lit ? (rnd() < 0.8 ? '#ffd9a0' : '#fff1cf') : '#3a3346';
      g.fillRect(c * cw + cw * 0.25, r * ch + ch * 0.22, cw * 0.5, ch * 0.56);
    }
  }
}

function drawMonitor(g, w, h) {
  g.fillStyle = '#1b1f3a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  g.fillStyle = '#ff9ebb';
  g.font = '400 88px "Space Mono", monospace';
  const word = 'PROJECTS';
  const step = 84;
  const x0 = w / 2 - (step * (word.length - 1)) / 2;
  g.textAlign = 'center';
  [...word].forEach((ch, i) => g.fillText(ch, x0 + i * step, h / 2 + 28));
  g.textAlign = 'left';
}

function drawPegboard(g, w, h) {
  g.fillStyle = '#1e2033';
  g.fillRect(0, 0, w, h);
  for (let y = 14; y < h; y += 24) for (let x = 14; x < w; x += 24) {
    g.fillStyle = '#07070d';
    g.beginPath();
    g.arc(x, y, 5.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.beginPath();
    g.arc(x, y + 6, 5.5, 0, Math.PI);
    g.fill();
  }
}

// The light behind the board, spilling onto the wall round its edges.
function drawHalo(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.filter = 'blur(22px)';
  g.fillStyle = 'rgba(255,205,228,0.75)';
  g.fillRect(w * 0.08, h * 0.1, w * 0.84, h * 0.8);
  g.filter = 'none';
}

const PHOTO = new Image();
PHOTO.src = `${import.meta.env.BASE_URL}sujal.jpg`;

// An ID badge: the org's colour band, the photo, the role, the dates, a barcode.
function drawBadge(g, w, h, b) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#eef0f4';
  roundRect(g, 0, 0, w, h, 14);
  g.fill();
  g.save();
  roundRect(g, 0, 0, w, h, 14);
  g.clip();
  g.fillStyle = b.color;
  g.fillRect(0, 0, w, h * 0.27);
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  roundRect(g, w * 0.38, 12, w * 0.24, 9, 4);
  g.fill();
  g.fillStyle = '#fff';
  g.font = '700 30px "Space Grotesk", sans-serif';
  g.textAlign = 'center';
  g.fillText(b.short, w / 2, h * 0.215, w - 20);
  const cx = w / 2;
  const cy = h * 0.44;
  const r = 46;
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#c3c6d3';
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (PHOTO.complete && PHOTO.naturalWidth) {
    const s = Math.min(PHOTO.naturalWidth, PHOTO.naturalHeight);
    g.drawImage(PHOTO, (PHOTO.naturalWidth - s) / 2, 0, s, s, cx - r, cy - r, r * 2, r * 2);
  }
  g.restore();
  g.fillStyle = '#1b1f33';
  g.font = '600 19px "Space Grotesk", sans-serif';
  g.fillText(b.role, w / 2, h * 0.66, w - 22);
  g.fillStyle = '#6a6e86';
  g.font = '400 14px "Space Mono", monospace';
  g.fillText(b.when.toUpperCase(), w / 2, h * 0.73, w - 22);
  g.fillStyle = '#1b1f33';
  for (let x = 40; x < w - 40; x += 3 + ((x * 7) % 4)) g.fillRect(x, h * 0.79, (x % 3) + 1, 30);
  g.fillStyle = '#9a9eb2';
  g.font = '400 11px "Space Mono", monospace';
  g.fillText('CLICK TO FLIP', w / 2, h * 0.94);
  g.textAlign = 'left';
}

// The back of a badge: the org on its band, then the points, wrapped.
function drawBadgeBack(g, w, h, b) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#eef0f4';
  roundRect(g, 0, 0, w, h, 14);
  g.fill();
  g.save();
  roundRect(g, 0, 0, w, h, 14);
  g.clip();
  g.fillStyle = b.color;
  g.fillRect(0, 0, w, 64);
  g.restore();
  g.fillStyle = '#fff';
  g.font = '700 22px "Space Grotesk", sans-serif';
  g.textAlign = 'center';
  g.fillText(b.org, w / 2, 42, w - 24);
  g.textAlign = 'left';
  g.font = '400 15px "Space Grotesk", sans-serif';
  let y = 92;
  for (const pt of b.points) {
    g.fillStyle = b.color;
    g.fillRect(16, y - 12, 3, 16);
    g.fillStyle = '#2a2e48';
    let line = '';
    for (const word of pt.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (g.measureText(t).width > w - 44) {
        g.fillText(line, 26, y);
        y += 20;
        line = word;
      } else line = t;
    }
    g.fillText(line, 26, y);
    y += 30;
  }
  g.fillStyle = '#9a9eb2';
  g.font = '400 11px "Space Mono", monospace';
  g.textAlign = 'center';
  g.fillText('CLICK TO FLIP BACK', w / 2, h * 0.95);
  g.textAlign = 'left';
}

// A sticker: an emoji pin with a white die-cut edge.
function drawSticker(g, w, h, glyph) {
  g.clearRect(0, 0, w, h);
  g.font = `${w * 0.68}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [3, 3], [-3, 3], [3, -3]]) {
    g.save();
    g.filter = 'brightness(0) invert(1)';
    g.fillText(glyph, w / 2 + dx, h / 2 + dy + 4);
    g.restore();
  }
  g.fillText(glyph, w / 2, h / 2 + 4);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const IOS_FONT = '-apple-system, "SF Pro Display", "Segoe UI", system-ui, sans-serif';

function drawPhone(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.save();
  roundRect(g, 0, 0, w, h, w * 0.13);
  g.clip();
  const bg = g.createLinearGradient(0, 0, w * 0.4, h);
  bg.addColorStop(0, '#2b1d4f');
  bg.addColorStop(0.5, '#7a3f8f');
  bg.addColorStop(1, '#f29bb8');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  for (const [x, y, r, c] of [[0.2, 0.75, 0.5, 'rgba(255,158,187,0.45)'], [0.85, 0.35, 0.45, 'rgba(120,90,220,0.4)']]) {
    const b = g.createRadialGradient(w * x, h * y, 0, w * x, h * y, w * r);
    b.addColorStop(0, c);
    b.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = b;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = `600 ${w * 0.05}px ${IOS_FONT}`;
  g.fillText(nowIST({ weekday: 'long', day: 'numeric', month: 'long' }), w / 2, h * 0.13);
  g.font = `700 ${w * 0.26}px ${IOS_FONT}`;
  g.fillText(nowIST({ hour: '2-digit', minute: '2-digit', hour12: false }), w / 2, h * 0.27);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (const x of [0.18, 0.82]) {
    g.beginPath();
    g.arc(w * x, h * 0.92, w * 0.07, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.85)';
  roundRect(g, w * 0.33, h * 0.982, w * 0.34, h * 0.006, 4);
  g.fill();
  // the notch
  g.fillStyle = '#000';
  roundRect(g, w * 0.31, -20, w * 0.38, h * 0.042 + 20, w * 0.06);
  g.fill();
  g.restore();
  g.textAlign = 'left';
}

function drawFace(g, w, h, gx = 0, gy = 0, blink = false, on = true, eyes = true) {
  if (!on) {
    g.fillStyle = '#0d0e16';
    g.fillRect(0, 0, w, h);
    return;
  }
  g.fillStyle = '#f7b3c8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  if (!eyes) return;
  g.fillStyle = '#1d1d2b';
  const eh = blink ? 6 : 52;
  g.fillRect(w * 0.27 - 12 + gx, h * 0.36 - eh / 2 + gy, 24, eh);
  g.fillRect(w * 0.73 - 12 + gx, h * 0.36 - eh / 2 + gy, 24, eh);
  g.fillRect(w / 2 - 30 + gx * 0.6, h * 0.7 + gy * 0.6, 60, 8);
}

/* ================= helpers ================= */

const Box = ({ args, color = '#222', rough = 0.8, metal = 0, ...props }) => (
  <mesh castShadow receiveShadow {...props}>
    <boxGeometry args={args} />
    <meshStandardMaterial color={color} roughness={rough} metalness={metal} />
  </mesh>
);

const Glow = ({ args, color, ...props }) => (
  <mesh {...props}>
    <boxGeometry args={args} />
    <meshBasicMaterial color={color} toneMapped={false} />
  </mesh>
);

function rrShape(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// A rounded-corner slab (rounded in plan view), bottom at y.
function Slab({ w, d, r, h, y = 0, children }) {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(rrShape(w, d, r), { depth: h, bevelEnabled: false, curveSegments: 16 }), [w, d, r, h]);
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position-y={y}>
      {children}
    </mesh>
  );
}

function Limb({ from, to, size = 0.08, color, rough = 0.6 }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const o = new THREE.Object3D();
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.lookAt(b);
    return { position: o.position.clone(), quaternion: o.quaternion.clone(), length: a.distanceTo(b) };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[size, size, length]} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

/* ================= the room ================= */

// The floor rug: white wool with a woven border, a diamond medallion, a dotted
// lattice of tufts and fringed short ends. Off-white greys with a blush accent.
function drawRug(g, w, h) {
  const rnd = seeded(31);
  g.clearRect(0, 0, w, h);
  const fr = 70; // fringe on the short ends
  const x0 = fr, x1 = w - fr;
  // wool base with a soft speckle
  g.fillStyle = '#f3f0ea';
  g.fillRect(x0, 0, x1 - x0, h);
  for (let i = 0; i < 26000; i++) {
    const v = 225 + rnd() * 30;
    g.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.35 + rnd() * 0.4})`;
    g.fillRect(x0 + rnd() * (x1 - x0), rnd() * h, 2, 2);
  }
  // woven border: two bands and a row of little chevrons between them
  const band = (inset, width, col) => {
    g.strokeStyle = col;
    g.lineWidth = width;
    g.strokeRect(x0 + inset, inset, x1 - x0 - inset * 2, h - inset * 2);
  };
  band(34, 10, '#d9d3c9');
  band(92, 4, '#d9d3c9');
  g.strokeStyle = '#e2c5cc';
  g.lineWidth = 3;
  const chevrons = (ax, ay, bx, by, n) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
      const horiz = ay === by;
      g.beginPath();
      if (horiz) { g.moveTo(cx - 12, cy - 7); g.lineTo(cx, cy + 7); g.lineTo(cx + 12, cy - 7); }
      else { g.moveTo(cx - 7, cy - 12); g.lineTo(cx + 7, cy); g.lineTo(cx - 7, cy + 12); }
      g.stroke();
    }
  };
  const m = 63;
  chevrons(x0 + m, m, x1 - m, m, 46);
  chevrons(x0 + m, h - m, x1 - m, h - m, 46);
  chevrons(x0 + m, m, x0 + m, h - m, 22);
  chevrons(x1 - m, m, x1 - m, h - m, 22);
  // a lattice of small tufted crosses
  g.strokeStyle = '#ddd7cd';
  g.lineWidth = 4;
  for (let y = 170; y < h - 140; y += 110) {
    for (let x = x0 + 170 + ((y / 110) % 2) * 55; x < x1 - 140; x += 110) {
      g.beginPath();
      g.moveTo(x - 9, y); g.lineTo(x + 9, y);
      g.moveTo(x, y - 9); g.lineTo(x, y + 9);
      g.stroke();
    }
  }
  // the medallion: nested rounded diamonds, solid wool inside, a blush heart of it
  const cx = w / 2, cy = h / 2;
  const diamond = (r, fill, stroke, lw) => {
    g.beginPath();
    g.moveTo(cx, cy - r * 0.62); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r * 0.62); g.lineTo(cx - r, cy); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
  };
  diamond(560, '#f3f0ea', '#d6cfc4', 8);
  diamond(470, null, '#e2c5cc', 3);
  diamond(390, '#ebe6de', '#d6cfc4', 6);
  diamond(250, '#f3f0ea', '#d6cfc4', 4);
  diamond(120, '#efd9de', '#e2c5cc', 4);
  // fringe
  g.strokeStyle = '#e9e4da';
  g.lineWidth = 5;
  for (let y = 12; y < h - 8; y += 14) {
    for (const [a, b] of [[x0, 6], [x1, w - 6]]) {
      g.beginPath();
      g.moveTo(a, y);
      g.lineTo(b + (rnd() - 0.5) * 10, y + (rnd() - 0.5) * 8);
      g.stroke();
    }
  }
}

// The desk mat: white felt, rounded, stitched; contour lines in one corner,
// a dot grid in the other, and a small wordmark.
function drawDeskMat(g, w, h) {
  const rnd = seeded(57);
  g.clearRect(0, 0, w, h);
  const r = 44;
  roundRect(g, 4, 4, w - 8, h - 8, r);
  g.save();
  g.clip();
  g.fillStyle = '#f6f4f0';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = 232 + rnd() * 22;
    g.fillStyle = `rgba(${v},${v - 3},${v - 6},0.5)`;
    g.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  // topographic contour lines, top-left
  g.strokeStyle = 'rgba(176,164,200,0.55)';
  g.lineWidth = 2.2;
  for (let k = 0; k < 9; k++) {
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const rr = 40 + k * 26 + Math.sin(a * 3 + k * 0.7) * 10 + Math.sin(a * 5 - k) * 6;
      const x = 120 + Math.cos(a) * rr * 1.35, y = 70 + Math.sin(a) * rr;
      a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  // a dot grid, right side
  g.fillStyle = 'rgba(150,140,160,0.35)';
  for (let y = 40; y < h - 30; y += 22) for (let x = w - 300; x < w - 40; x += 22) {
    g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
  }
  // wordmark
  g.fillStyle = 'rgba(232,150,175,0.9)';
  g.font = '600 26px "Space Mono", monospace';
  g.textAlign = 'right';
  g.fillText('sujal.dev', w - 46, h - 34);
  g.textAlign = 'left';
  g.restore();
  // stitched edge
  g.strokeStyle = '#cfc8bf';
  g.lineWidth = 3;
  g.setLineDash([10, 8]);
  roundRect(g, 18, 18, w - 36, h - 36, r - 14);
  g.stroke();
  g.setLineDash([]);
}

// A pendant lamp hung from the ceiling: cord, a cream dome shade glowing warm
// inside, and the light that pools on the floor below it.
function Pendant({ x, z, drop = 0.95 }) {
  const y = 3.4 - drop;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.4 - drop / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, drop, 6]} />
        <meshStandardMaterial color="#1b1b22" />
      </mesh>
      <mesh position={[0, 3.39, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
        <meshStandardMaterial color="#1b1b22" />
      </mesh>
      <mesh position={[0, y - 0.1, 0]} castShadow>
        <sphereGeometry args={[0.22, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#efe6da" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, y - 0.1, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.2, 32]} />
        <meshBasicMaterial color={[2.6, 2.0, 1.4]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, y - 0.13, 0]}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <meshBasicMaterial color={[4, 3.2, 2.2]} toneMapped={false} />
      </mesh>
      <pointLight position={[0, y - 0.25, 0]} color="#ffc98f" intensity={2.6} distance={4.5} decay={2} />
    </group>
  );
}

function Pendants() {
  return (
    <>
      <Pendant x={-1.15} z={-1.25} />
      <Pendant x={-2.95} z={-1.25} drop={1.1} />
      <Pendant x={0.3} z={-3.4} drop={0.8} />
    </>
  );
}

function Shell() {
  const tex = useMemo(() => {
    const mk = (rx, ry) => canvasTexture(256, 256, drawPanels, [rx, ry]);
    return {
      backL: mk((WINDOW.x0 + 5) / 1.3, 3.4 / 1.13),
      backR: mk((5.5 - WINDOW.x1) / 1.3, 3.4 / 1.13),
      under: mk((WINDOW.x1 - WINDOW.x0) / 1.3, WINDOW.y0 / 1.13),
      over: mk((WINDOW.x1 - WINDOW.x0) / 1.3, (3.4 - WINDOW.y1) / 1.13),
      side: mk(8 / 1.3, 3.4 / 1.13),
      floor: canvasTexture(512, 512, drawHerringbone, [5, 4]),
      sun: canvasTexture(512, 384, drawSunPatch),
      rug: canvasTexture(2048, 1424, drawRug),
    };
  }, []);
  const wall = (t) => <meshStandardMaterial map={t} roughness={0.92} />;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0.25, 0, -0.5]}>
        <planeGeometry args={[10.5, 8]} />
        <meshStandardMaterial map={tex.floor} roughness={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0.75, 0.006, -2.25]} rotation-z={0.35}>
        <planeGeometry args={[1.5, 1.1]} />
        <meshBasicMaterial map={tex.sun} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* rug */}
      <mesh rotation-x={-Math.PI / 2} rotation-z={DESK.rotY} position={[DESK.pos[0] + 0.1, 0.004, DESK.pos[2] + 0.2]}>
        <planeGeometry args={[4.6, 3.2]} />
        <meshStandardMaterial map={tex.rug} transparent alphaTest={0.05} roughness={1} />
      </mesh>
      {/* back wall, around the window opening */}
      <mesh position={[(WINDOW.x0 - 5) / 2, 1.7, -4.5]}><planeGeometry args={[WINDOW.x0 + 5, 3.4]} />{wall(tex.backL)}</mesh>
      <mesh position={[(WINDOW.x1 + 5.5) / 2, 1.7, -4.5]}><planeGeometry args={[5.5 - WINDOW.x1, 3.4]} />{wall(tex.backR)}</mesh>
      <mesh position={[(WINDOW.x0 + WINDOW.x1) / 2, WINDOW.y0 / 2, -4.5]}><planeGeometry args={[WINDOW.x1 - WINDOW.x0, WINDOW.y0]} />{wall(tex.under)}</mesh>
      <mesh position={[(WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y1 + 3.4) / 2, -4.5]}><planeGeometry args={[WINDOW.x1 - WINDOW.x0, 3.4 - WINDOW.y1]} />{wall(tex.over)}</mesh>
      <mesh position={[-5, 1.7, -0.5]} rotation-y={Math.PI / 2}><planeGeometry args={[8, 3.4]} />{wall(tex.side)}</mesh>
      <mesh position={[5.5, 1.7, -0.5]} rotation-y={-Math.PI / 2}><planeGeometry args={[8, 3.4]} />{wall(tex.side)}</mesh>
      <mesh position={[0.25, 3.4, -0.5]} rotation-x={Math.PI / 2}><planeGeometry args={[10.5, 8]} /><meshStandardMaterial color="#17161c" /></mesh>
      {/* skirting */}
      <Box args={[10.5, 0.1, 0.03]} position={[0.25, 0.05, -4.48]} color="#16151b" />
      <Box args={[0.03, 0.1, 8]} position={[-4.98, 0.05, -0.5]} color="#16151b" />
      <Glow args={[0.015, 0.01, 8]} position={[5.48, 0.1, -0.5]} color={[1.5, 1.3, 1.6]} />
    </group>
  );
}

function Palm({ position, h = 3.2, lean = 0.15 }) {
  const fronds = useMemo(() => Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2), []);
  return (
    <group position={position} rotation-z={lean}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.06, h * (i + 0.5) / 3, 0]} rotation-z={-0.05 * i}>
          <cylinderGeometry args={[0.07 - i * 0.012, 0.09 - i * 0.012, h / 3 + 0.05, 8]} />
          <meshStandardMaterial color="#6b5440" roughness={0.9} />
        </mesh>
      ))}
      <group position={[0.15, h, 0]}>
        {fronds.map((a, i) => (
          <mesh key={i} rotation={[0, a, -0.45 - (i % 2) * 0.3]} position={[Math.cos(a) * 0.55, -0.15, -Math.sin(a) * 0.55]} scale={[1, 0.08, 0.28]}>
            <sphereGeometry args={[0.65, 12, 8]} />
            <meshStandardMaterial color={i % 2 ? '#3f7a4f' : '#4f8c5a'} roughness={0.75} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function City() {
  const { buildings, sky } = useMemo(() => {
    const rnd = seeded(41);
    const baseMap = canvasTexture(256, 256, (g, w, h) => drawFacade(g, w, h, false));
    const baseGlow = canvasTexture(256, 256, (g, w, h) => drawFacade(g, w, h, true));
    const tints = ['#8c6f7c', '#a6848c', '#6f5f78', '#b98f80', '#7b6a86', '#9a7b6c'];
    const list = [];
    // a near row of low roofs (kept under the line of sight to the road), the road at
    // z -10.5, then the city rising behind it
    const rows = [
      { z: -6.4, top: [-2.4, -1.1], w: [2.5, 4], d: [2, 2.4] },
      { z: -13.2, top: [1, 6], w: [3, 5], d: [3, 5] },
      { z: -19, top: [5, 12], w: [3.5, 6], d: [3, 6] },
      { z: -27, top: [9, 20], w: [4, 7], d: [3, 6] },
    ];
    rows.forEach((row, ri) => {
      for (let x = -16; x < 12; ) {
        const w = row.w[0] + rnd() * (row.w[1] - row.w[0]);
        const top = row.top[0] + rnd() * (row.top[1] - row.top[0]);
        const h = top + 20;
        const d = row.d[0] + rnd() * (row.d[1] - row.d[0]);
        const [t, e] = [baseMap, baseGlow].map((b) => {
          const c = b.clone();
          c.wrapS = c.wrapT = THREE.RepeatWrapping;
          c.repeat.set(w / 8, h / 8);
          c.offset.set(rnd(), rnd());
          c.needsUpdate = true;
          return c;
        });
        list.push({ x: x + w / 2, z: row.z - d / 2 - (ri ? rnd() * 1.5 : 0), w, h, d, top, tex: t, glow: e, color: tints[Math.floor(rnd() * tints.length)], tanks: ri < 2 && rnd() < 0.6 });
        x += w + 0.6 + rnd() * 1.5;
      }
    });
    return { buildings: list, sky: canvasTexture(512, 512, drawSky) };
  }, []);
  return (
    <group>
      <mesh position={[0, 6, -44]}>
        <planeGeometry args={[120, 60]} />
        <meshBasicMaterial map={sky} fog={false} toneMapped={false} />
      </mesh>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.top - b.h / 2, b.z]}>
          <mesh>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} map={b.tex} emissiveMap={b.glow} emissive="#ffcf8a" emissiveIntensity={1.2} roughness={0.85} />
          </mesh>
          <mesh position={[0, b.h / 2 + 0.05, 0]}>
            <boxGeometry args={[b.w + 0.1, 0.1, b.d + 0.1]} />
            <meshStandardMaterial color="#5a4a58" />
          </mesh>
          {b.tanks &&
            [-0.5, 0.5].map((dx) => (
              <mesh key={dx} position={[dx * b.w * 0.4, b.h / 2 + 0.35, 0]}>
                <cylinderGeometry args={[0.28, 0.28, 0.5, 14]} />
                <meshStandardMaterial color="#d8d2d6" roughness={0.6} />
              </mesh>
            ))}
        </group>
      ))}
      <Street />
      <Palm position={[-3.7, -0.6, -9.2]} h={3.8} lean={0.1} />
      <Palm position={[-1.0, -0.6, -9.2]} h={4.4} lean={-0.12} />
      <Palm position={[1.6, -0.6, -11.9]} h={3.9} lean={0.18} />
      <Palm position={[-5.6, -0.6, -11.9]} h={4.2} lean={-0.08} />
      <directionalLight position={[-3, 6, -10]} intensity={1.1} color="#ffb98a" />
    </group>
  );
}

// The road: two lanes of traffic, kerbs, street lamps.
const ROAD = { y: -0.6, z: -10.5, x0: -26, x1: 18 };
const CAR_COLORS = ['#c94c4c', '#e8e4dc', '#2f4f8f', '#1b1b22', '#d9a441', '#6d8f9e', '#8a3f6a', '#3f6e4f'];

function drawRoad(g, w, h) {
  g.fillStyle = '#26232b';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  g.fillStyle = '#e9d9a6';
  for (let x = 0; x < w; x += 64) g.fillRect(x, h / 2 - 2, 34, 4);
  g.fillStyle = '#cfcbd2';
  g.fillRect(0, 6, w, 3);
  g.fillRect(0, h - 9, w, 3);
}

function Car({ lane, offset, speed, color }) {
  const ref = useRef();
  const len = ROAD.x1 - ROAD.x0;
  useFrame(({ clock }) => {
    const t = (offset + clock.elapsedTime * speed) % len;
    ref.current.position.x = lane > 0 ? ROAD.x0 + t : ROAD.x1 - t;
  });
  const dir = lane > 0 ? 1 : -1;
  return (
    <group ref={ref} position={[0, ROAD.y, ROAD.z + lane * 0.5]} rotation-y={lane > 0 ? 0 : Math.PI}>
      <RoundedBox args={[1.6, 0.32, 0.72]} radius={0.08} smoothness={2} position={[0, 0.26, 0]} castShadow>
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[0.86, 0.26, 0.64]} radius={0.08} smoothness={2} position={[-0.08, 0.52, 0]}>
        <meshStandardMaterial color="#141820" metalness={0.6} roughness={0.15} />
      </RoundedBox>
      {[[-0.52, 0.36], [0.52, 0.36], [-0.52, -0.36], [0.52, -0.36]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.13, z]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.13, 0.13, 0.08, 14]} />
          <meshStandardMaterial color="#111" roughness={0.8} />
        </mesh>
      ))}
      {/* headlights ahead, tail-lights behind */}
      {[-0.22, 0.22].map((z) => (
        <group key={z}>
          <mesh position={[0.81, 0.28, z]}><boxGeometry args={[0.02, 0.07, 0.14]} /><meshBasicMaterial color={[4, 3.6, 2.6]} toneMapped={false} /></mesh>
          <mesh position={[-0.81, 0.28, z]}><boxGeometry args={[0.02, 0.06, 0.14]} /><meshBasicMaterial color={[3.2, 0.25, 0.25]} toneMapped={false} /></mesh>
        </group>
      ))}
      <mesh position={[1.6, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial color="#ffe2a8" transparent opacity={0.12} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function StreetLamp({ x, z, flip }) {
  const metal = <meshStandardMaterial color="#3a3d48" metalness={0.6} roughness={0.4} />;
  return (
    <group position={[x, ROAD.y, z]} rotation-y={flip ? Math.PI : 0}>
      <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.05, 0.08, 3, 10]} />{metal}</mesh>
      <mesh position={[0.3, 3.0, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.03, 0.03, 0.62, 8]} />{metal}</mesh>
      <mesh position={[0.6, 2.95, 0]}><boxGeometry args={[0.28, 0.08, 0.16]} />{metal}</mesh>
      <mesh position={[0.6, 2.9, 0]}>
        <boxGeometry args={[0.22, 0.02, 0.12]} />
        <meshBasicMaterial color={[4, 3.2, 2]} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Street() {
  const road = useMemo(() => canvasTexture(1024, 128, drawRoad, [6, 1]), []);
  const cars = useMemo(() => {
    const rnd = seeded(9);
    return Array.from({ length: 9 }, (_, i) => ({ lane: i % 2 ? 1 : -1, offset: rnd() * 44, speed: 2.6 + rnd() * 2.4, color: CAR_COLORS[i % CAR_COLORS.length] }));
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[(ROAD.x0 + ROAD.x1) / 2, ROAD.y, ROAD.z]} receiveShadow>
        <planeGeometry args={[ROAD.x1 - ROAD.x0, 2.2]} />
        <meshStandardMaterial map={road} roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(ROAD.x0 + ROAD.x1) / 2, ROAD.y + 0.06, ROAD.z + side * 1.45]} receiveShadow>
          <boxGeometry args={[ROAD.x1 - ROAD.x0, 0.12, 0.7]} />
          <meshStandardMaterial color="#8e8790" roughness={0.9} />
        </mesh>
      ))}
      {cars.map((c, i) => <Car key={i} {...c} />)}
      {[-14, -8, -2, 4, 10].map((x, i) => (
        <StreetLamp key={x} x={x} z={ROAD.z + (i % 2 ? 1.5 : -1.5)} flip={i % 2 === 1} />
      ))}
    </group>
  );
}

function Window() {
  const frame = '#121116';
  const w = WINDOW.x1 - WINDOW.x0;
  const h = WINDOW.y1 - WINDOW.y0;
  return (
    <group position={[(WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2, -4.5]}>
      <Box args={[w + 0.1, 0.06, 0.12]} position={[0, h / 2, 0]} color={frame} />
      <Box args={[w + 0.1, 0.06, 0.12]} position={[0, -h / 2, 0]} color={frame} />
      <Box args={[0.06, h + 0.06, 0.12]} position={[-w / 2, 0, 0]} color={frame} />
      <Box args={[0.06, h + 0.06, 0.12]} position={[w / 2, 0, 0]} color={frame} />
      <Box args={[0.05, h, 0.08]} position={[w * 0.17, 0, 0]} color={frame} />
      <Box args={[w + 0.2, 0.05, 0.3]} position={[0, -h / 2 - 0.02, 0.14]} color="#1b1a21" />
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.06} roughness={0.05} metalness={0} />
      </mesh>
      <pointLight position={[0, -0.3, 1.2]} color="#ffb98a" intensity={4} distance={7} decay={2} />
    </group>
  );
}

const BOOK_COLORS = ['#1f4f8f', '#c23b4e', '#2e8a73', '#e7b44a', '#f2ece4', '#2a3a6e', '#7a1f2b', '#3f78c2', '#1d1d24'];

function Shelf() {
  const books = useMemo(() => {
    const rnd = seeded(7);
    const out = [];
    let z = -0.85;
    while (z < 0.15) {
      const w = 0.04 + rnd() * 0.03;
      const h = 0.24 + rnd() * 0.12;
      out.push({ z: z + w / 2, w, h, c: BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)] });
      z += w + 0.003;
    }
    return out;
  }, []);
  const posters = useMemo(
    () =>
      [0, 1].map((k) =>
        canvasTexture(256, 320, (g, w, h) => {
          g.fillStyle = '#f2ece4';
          g.fillRect(0, 0, w, h);
          if (k === 0) {
            g.fillStyle = '#2b3a8f';
            g.fillRect(18, 18, w - 36, h - 36);
            g.fillStyle = '#f2b544';
            g.beginPath();
            g.arc(w / 2, h * 0.64, 72, Math.PI, 0);
            g.fill();
            g.fillStyle = '#5fc8e0';
            g.fillRect(40, h * 0.3, w - 80, 14);
          } else {
            g.fillStyle = '#1b1f33';
            g.fillRect(18, 18, w - 36, h - 36);
            const cols = ['#ff6f9c', '#5fc8e0', '#f2b544', '#f2ece4'];
            g.lineWidth = 18;
            for (let i = 0; i < 9; i++) {
              g.strokeStyle = cols[i % 4];
              g.beginPath();
              g.moveTo(i * 44 - 140, h - 18);
              g.lineTo(i * 44 + 40, 18);
              g.stroke();
            }
          }
        }),
      ),
    [],
  );
  return (
    <group position={[-5, 0.24, -3.07]} rotation-y={Math.PI / 2}>
      <Box args={[1.9, 0.04, 0.28]} position={[0, 1.6, 0.14]} color="#1b1a21" />
      <Glow args={[1.8, 0.01, 0.02]} position={[0, 1.575, 0.26]} color={[3.2, 2.0, 1.0]} />
      <pointLight position={[0, 1.35, 0.45]} color="#ffb36b" intensity={1.8} distance={2.6} decay={2} />
      {books.map((b, i) => (
        <Box key={i} args={[b.w, b.h, 0.19]} position={[b.z, 1.62 + b.h / 2, 0.13]} color={b.c} rough={0.7} />
      ))}
      {[0, 1, 2].map((i) => (
        <Box key={i} args={[0.36, 0.04, 0.25]} position={[0.45, 1.64 + i * 0.04, 0.13]} rotation-y={i * 0.12} color={['#2a2833', '#c9c3cf', '#1f4f8f'][i]} />
      ))}
      <mesh position={[0.78, 1.67, 0.13]}>
        <cylinderGeometry args={[0.06, 0.05, 0.1, 16]} />
        <meshStandardMaterial color="#e8e6e2" />
      </mesh>
      <mesh position={[0.78, 1.75, 0.13]} scale={[1, 0.6, 1]}>
        <icosahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color="#5f9a6a" flatShading />
      </mesh>
      {posters.map((t, k) => (
        <group key={k} position={[-0.5 + k * 0.9, 2.65, 0.02]}>
          <Box args={[0.66, 0.82, 0.03]} color="#15141a" />
          <mesh position={[0, 0, 0.017]}>
            <planeGeometry args={[0.58, 0.74]} />
            <meshStandardMaterial map={t} roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* fairy lights */}
      {Array.from({ length: 16 }, (_, i) => {
        const z = -1.0 + (i / 15) * 2.1;
        const y = 2.2 - Math.sin((i / 15) * Math.PI) * 0.12;
        return (
          <mesh key={i} position={[z, y, 0.04]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshBasicMaterial color={[3, 2.2, 1.2]} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function Desk() {
  const mat = useMemo(() => canvasTexture(1184, 372, drawDeskMat), []);
  return (
    <group>
      <group position={DESK.pos} rotation-y={DESK.rotY}>
        <Slab w={DESK.w - 0.16} d={DESK.d - 0.16} r={0.22} h={0.7}>
          <meshStandardMaterial color="#c9c6cf" roughness={0.5} />
        </Slab>
        <Slab w={DESK.w - 0.04} d={DESK.d - 0.04} r={0.27} h={0.02} y={0.7}>
          <meshBasicMaterial color={[3.6, 2.2, 1.1]} toneMapped={false} />
        </Slab>
        <Slab w={DESK.w} d={DESK.d} r={0.28} h={0.08} y={0.72}>
          <meshStandardMaterial color="#141318" roughness={0.3} metalness={0.2} />
        </Slab>
        {/* the big desk mat under the monitor, keyboard and mouse */}
        <mesh rotation-x={-Math.PI / 2} position={[0.33, 0.802, -0.12]}>
          <planeGeometry args={[1.85, 0.58]} />
          <meshStandardMaterial map={mat} transparent alphaTest={0.05} roughness={0.95} />
        </mesh>
      </group>
      {/* notebook and pen, sticky notes */}
      <Box args={[0.3, 0.016, 0.2]} position={[-3.15, 0.81, -1.95]} rotation-y={0.2} color="#2b3150" />
      <Limb from={[-3.25, 0.822, -1.92]} to={[-3.06, 0.822, -2.0]} size={0.012} color="#1b1b22" />
      <Box args={[0.08, 0.004, 0.08]} position={[-2.35, 0.804, -1.98]} rotation-y={0.3} color="#f5e66b" />
      <Box args={[0.07, 0.004, 0.07]} position={[-2.24, 0.804, -1.9]} rotation-y={-0.2} color="#f4eee6" />
      {/* the robot's keyboard and mouse */}
      <Keyboard position={[ROBOT.pos[0], 0.8, ROBOT.pos[2] + 0.4]} />
      <Mouse position={[ROBOT.pos[0] - 0.36, 0.8, ROBOT.pos[2] + 0.42]} />
      <Lamp />
    </group>
  );
}

function Lamp() {
  return (
    <group position={[-3.64, 0.8, -2.9]} rotation-y={0.9}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.12, 0.04, 24]} />
        <meshStandardMaterial color="#1b1b22" metalness={0.6} roughness={0.35} />
      </mesh>
      <Limb from={[0, 0.03, 0]} to={[-0.06, 0.62, -0.06]} size={0.02} color="#1b1b22" />
      <Limb from={[-0.06, 0.62, -0.06]} to={[0.34, 0.92, 0.2]} size={0.02} color="#1b1b22" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[-0.012 * i, 0.12 + i * 0.07, -0.012 * i]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.018, 0.004, 6, 12]} />
          <meshStandardMaterial color="#8a8a96" metalness={0.6} />
        </mesh>
      ))}
      <group position={[0.4, 0.88, 0.24]} rotation={[0.35, 0, -0.85]}>
        <mesh>
          <coneGeometry args={[0.16, 0.24, 28, 1, true]} />
          <meshStandardMaterial color="#e48fb5" roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color={[3, 2.2, 1.8]} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0.5, 0.6, 0.3]} color="#ffc2c8" intensity={2.4} distance={2.8} decay={2} />
    </group>
  );
}

// The bezel: a ring of four sloped faces from the front edge in to the recessed screen,
// plus the short outer walls, as one flat-shaded geometry.
function bezelGeometry(W, H, w, h, d) {
  const O = [[-W / 2, -H / 2, 0], [W / 2, -H / 2, 0], [W / 2, H / 2, 0], [-W / 2, H / 2, 0]];
  const I = [[-w / 2, -h / 2, -d], [w / 2, -h / 2, -d], [w / 2, h / 2, -d], [-w / 2, h / 2, -d]];
  const B = O.map(([x, y]) => [x, y, -d]);
  const pts = [];
  const quad = (a, b, c, e) => pts.push(...a, ...b, ...c, ...a, ...c, ...e);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(O[i], O[j], I[j], I[i]);
    quad(B[i], B[j], O[j], O[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.computeVertexNormals();
  return g;
}

const MONITOR_NAVY = '#1c1f3d';

function Monitor() {
  const [tex] = useCanvas(1024, 576, drawMonitor);
  const { W, H, D } = MONITOR;
  const bezel = useMemo(() => bezelGeometry(W, H, SCREEN.w, SCREEN.h, SCREEN.recess), []);
  const navy = <meshStandardMaterial color={MONITOR_NAVY} roughness={0.42} metalness={0.15} />;
  return (
    <group position={MONITOR.pos} rotation-y={MONITOR.rotY}>
      {/* foot and neck */}
      <RoundedBox args={[0.5, 0.035, 0.26]} radius={0.01} smoothness={2} position={[0, 0.0175, -0.02]}>{navy}</RoundedBox>
      <Box args={[0.17, SCREEN.y - H / 2 + 0.04, 0.05]} position={[0, (SCREEN.y - H / 2 + 0.04) / 2 + 0.02, -0.09]} color={MONITOR_NAVY} rough={0.42} />
      {/* the body, behind the bezel */}
      <group position={[0, SCREEN.y, 0]}>
        <mesh geometry={bezel}>
          <meshStandardMaterial color="#232748" roughness={0.38} metalness={0.15} flatShading />
        </mesh>
        <mesh position={[0, 0, -SCREEN.recess - (D - SCREEN.recess) / 2]}>
          <boxGeometry args={[W, H, D - SCREEN.recess]} />
          {navy}
        </mesh>
        <mesh position={[0, 0, -SCREEN.recess + 0.0015]}>
          <planeGeometry args={[SCREEN.w, SCREEN.h]} />
          <meshBasicMaterial map={tex} color={[1.1, 1.1, 1.1]} toneMapped={false} />
        </mesh>
        {/* the thin light along the bottom bezel */}
        <Glow args={[SCREEN.w * 0.8, 0.003, 0.003]} position={[0, -H / 2 + 0.004, 0.002]} color={[1.2, 1.3, 1.8]} />
      </group>
      <pointLight position={[0, 0.45, 0.5]} color="#8f8cff" intensity={0.6} distance={2} decay={2} />
    </group>
  );
}

// The robot, built from the reference's own proportions (its J table, ×1.15 to this room).
const s115 = (v) => v * 1.15;
const J = {
  seat: 0.52,
  pelvisW: s115(0.27), pelvisH: s115(0.11),
  waistW: s115(0.17), waistH: s115(0.09),
  bellyW: s115(0.25), bellyH: s115(0.1),
  chestW: s115(0.28), chestH: s115(0.25), chestD: s115(0.21),
  coreD: s115(0.17),
  neckR: s115(0.05), neckH: s115(0.1),
  headW: s115(0.35), headH: s115(0.28), headD: s115(0.26),
  shoulderHalf: s115(0.2), armW: s115(0.105), palmW: s115(0.115),
};
J.pelvisY = J.seat + J.pelvisH / 2;
J.waistY = J.seat + J.pelvisH + J.waistH / 2;
J.bellyY = J.seat + J.pelvisH + J.waistH + J.bellyH / 2;
J.chestY = J.seat + J.pelvisH + J.waistH + J.bellyH + J.chestH / 2;
J.chestTop = J.chestY + J.chestH / 2;
J.headY = J.chestTop + J.neckH + J.headH / 2;
// the face screen: centred on the head's front, 82% × 74% of it
const FACE = { x: 0, y: 0, w: J.headW * 0.82, h: J.headH * 0.74 };

const SHELL = '#cfc4b2';
const SHELL_DARK = '#2b2f38';
const JOINT = '#d8e0e8';

const Part = ({ args, color, metal = 0.1, rough = 0.5, r, ...props }) => (
  <RoundedBox args={args} radius={r ?? Math.min(...args) * 0.18} smoothness={2} castShadow receiveShadow {...props}>
    <meshStandardMaterial color={color} metalness={metal} roughness={rough} />
  </RoundedBox>
);

function Gear({ r = 0.1, teeth = 10, spin = 0.5, ...props }) {
  const ref = useRef();
  useFrame((_, dt) => (ref.current.rotation.x += dt * spin));
  return (
    <group {...props}>
      <group ref={ref}>
        <mesh rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[r, r, 0.07, 28]} />
          <meshStandardMaterial color={SHELL_DARK} metalness={0.8} roughness={0.7} />
        </mesh>
        {Array.from({ length: teeth }, (_, i) => {
          const a = (i / teeth) * Math.PI * 2;
          return (
            <mesh key={i} position={[0, Math.cos(a) * (r + 0.02), Math.sin(a) * (r + 0.02)]} rotation-x={a}>
              <boxGeometry args={[0.07, 0.045, 0.05]} />
              <meshStandardMaterial color={SHELL_DARK} metalness={0.8} roughness={0.7} />
            </mesh>
          );
        })}
      </group>
      <mesh rotation-z={Math.PI / 2} position={[0.04, 0, 0]}>
        <cylinderGeometry args={[r * 0.4, r * 0.4, 0.03, 20]} />
        <meshStandardMaterial color={JOINT} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

const Screw = (props) => (
  <mesh {...props} rotation-x={Math.PI / 2}>
    <cylinderGeometry args={[0.012, 0.012, 0.01, 12]} />
    <meshStandardMaterial color={JOINT} metalness={0.6} roughness={0.3} />
  </mesh>
);

function Dial(props) {
  return (
    <group {...props}>
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.038, 0.04, 0.025, 24]} />
        <meshStandardMaterial color="#6b6f8a" metalness={0.45} roughness={0.35} />
      </mesh>
      <Box args={[0.004, 0.044, 0.006]} position={[-0.014, 0, 0]} color="#2a2b3a" />
    </group>
  );
}

// An arm reaching from the shoulder to the keys: upper arm, steel elbow bracket, forearm, hand.
function Arm({ side, fingers }) {
  const sx = side * J.shoulderHalf;
  const elbow = [side * (J.shoulderHalf + 0.03), 0.86, 0.15];
  const wrist = [side * 0.15, 0.885, 0.36];
  return (
    <group>
      <Limb from={[sx, J.chestTop - 0.05, 0]} to={elbow} size={J.armW} color={SHELL} rough={0.5} />
      <mesh position={elbow} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.05, 0.05, J.armW + 0.03, 18]} />
        <meshStandardMaterial color={JOINT} metalness={0.6} roughness={0.3} />
      </mesh>
      <Limb from={elbow} to={wrist} size={J.armW * 0.9} color={SHELL} rough={0.5} />
      <group position={[side * 0.13, 0.875, 0.44]} rotation-y={side * 0.15}>
        <Part args={[J.palmW, 0.035, 0.12]} color={SHELL_DARK} metal={0.6} rough={0.6} />
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} ref={(el) => (fingers.current[(side > 0 ? 4 : 0) + i] = el)} position={[-0.042 + i * 0.028, -0.008, 0.08]} castShadow>
            <boxGeometry args={[0.02, 0.024, 0.06]} />
            <meshStandardMaterial color={SHELL} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function OfficeChair() {
  return (
    <group position={[0, 0, -0.04]}>
      <Part args={[0.5, 0.07, 0.48]} color="#1d1e24" position={[0, J.seat - 0.04, 0]} />
      <Part args={[0.48, 0.62, 0.07]} color="#1d1e24" position={[0, J.seat + 0.36, -0.27]} rotation-x={-0.08} />
      <mesh position={[0, J.seat / 2 - 0.04, 0]}>
        <cylinderGeometry args={[0.03, 0.03, J.seat - 0.08, 10]} />
        <meshStandardMaterial color="#9a9aa6" metalness={0.8} roughness={0.3} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation-y={a}>
            <Box args={[0.04, 0.03, 0.3]} position={[0, 0.06, 0.15]} color="#1d1e24" />
            <mesh position={[0, 0.03, 0.3]}>
              <sphereGeometry args={[0.03, 10, 8]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Robot({ awake, track }) {
  const head = useRef();
  const faceMat = useRef();
  const fingers = useRef([]);
  const [tex, redraw] = useCanvas(256, 186, drawFace);
  const face = useRef();
  const s = useRef({ wokeAt: null, key: '', nextBlink: 3, yaw: 0, pitch: 0 });

  useFrame(({ clock, pointer: p }, dt) => {
    const st = s.current;
    const t = clock.elapsedTime;
    // the head follows the mouse, the reference's way: 0.45 rad across, 0.25 up and down, 8% a frame
    const ty = track ? p.x * 0.45 : 0;
    const tp = track ? -p.y * 0.25 : 0;
    const k = 1 - Math.pow(0.92, Math.min(dt, 0.05) * 60);
    st.yaw += (ty - st.yaw) * k;
    st.pitch += (tp - st.pitch) * k;
    head.current.rotation.set(st.pitch, st.yaw, 0, 'YXZ');
    fingers.current.forEach((f, i) => {
      if (f) f.position.y = -0.008 + (awake ? Math.max(0, Math.sin(t * 11 + i * 1.9)) * 0.01 : 0);
    });

    if (awake && st.wokeAt === null) st.wokeAt = t;
    const w = st.wokeAt === null ? 0 : clamp((t - st.wokeAt - 0.15) / 0.6, 0, 1);
    const on = w > 0;
    const eyes = w > 0.75;
    face.current.scale.set(Math.max(0.01, smoothstep(w, 0, 0.3)), Math.max(0.03, smoothstep(w, 0.3, 0.7)), 1);
    let blink = false;
    if (on && t > st.nextBlink) {
      blink = true;
      if (t > st.nextBlink + 0.12) st.nextBlink = t + 2.5 + Math.random() * 3;
    }
    const gx = track ? Math.round(clamp(p.x, -1, 1) * 14) : 0;
    const gy = track ? Math.round(clamp(-p.y, -1, 1) * 8) : 0;
    const key = `${on}${blink}${eyes}${gx},${gy}`;
    if (key !== st.key) {
      st.key = key;
      redraw(gx, gy, blink, on, eyes);
      faceMat.current.color.setScalar(on ? 1.35 : 1);
    }
  });

  const front = J.chestD / 2 + 0.006;
  return (
    <group position={ROBOT.pos} rotation-y={ROBOT.rotY}>
      <OfficeChair />
      {/* body, bottom to top: pelvis, dark waist, belly, chest */}
      <Part args={[J.pelvisW, J.pelvisH, J.chestD * 0.92]} color={SHELL} position={[0, J.pelvisY, 0]} />
      <Part args={[J.waistW, J.waistH, J.coreD * 1.1]} color={SHELL_DARK} metal={0.8} rough={0.7} position={[0, J.waistY, 0]} />
      <Part args={[J.bellyW, J.bellyH, J.chestD * 0.95]} color={SHELL} position={[0, J.bellyY, 0]} />
      <Part args={[J.chestW, J.chestH, J.chestD]} color={SHELL} position={[0, J.chestY, 0]} />
      <Part args={[J.chestW * 0.44, 0.04, 0.02]} color={SHELL_DARK} position={[-J.chestW * 0.16, J.chestY + J.chestH * 0.22, front]} r={0.008} />
      <Part args={[J.chestW * 0.44, 0.04, 0.02]} color={SHELL_DARK} position={[-J.chestW * 0.16, J.chestY + J.chestH * 0.02, front]} r={0.008} />
      <mesh position={[J.chestW * 0.3, J.chestY + J.chestH * 0.12, front]}>
        <boxGeometry args={[0.1, 0.1, 0.02]} />
        <meshStandardMaterial color="#05070c" emissive="#ff9ebb" emissiveIntensity={0.9} roughness={0.3} />
      </mesh>
      {[-1, 1].map((a) => [-1, 1].map((b) => (
        <Screw key={`${a}${b}`} position={[a * (J.chestW / 2 - 0.03), J.chestY + b * (J.chestH / 2 - 0.03), front]} />
      )))}
      {/* thighs forward under the desk, shins down */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Part args={[0.12, 0.12, 0.42]} color={SHELL} position={[sd * 0.1, J.seat + 0.06, 0.2]} />
          <Part args={[0.1, J.seat, 0.11]} color={SHELL_DARK} metal={0.8} rough={0.7} position={[sd * 0.1, J.seat / 2 + 0.02, 0.4]} />
          <Part args={[0.12, 0.05, 0.22]} color={SHELL} position={[sd * 0.1, 0.025, 0.45]} />
        </group>
      ))}
      {/* shoulders: big dark gears */}
      <Gear r={0.1} position={[J.chestW / 2 + 0.05, J.chestTop - 0.06, 0]} />
      <Gear r={0.1} spin={-0.5} position={[-J.chestW / 2 - 0.05, J.chestTop - 0.06, 0]} />
      <Arm side={-1} fingers={fingers} />
      <Arm side={1} fingers={fingers} />
      {/* neck */}
      <mesh position={[0, J.chestTop + J.neckH / 2, 0]}>
        <cylinderGeometry args={[J.neckR, J.neckR * 1.2, J.neckH, 20]} />
        <meshStandardMaterial color={SHELL_DARK} metalness={0.8} roughness={0.7} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, J.chestTop + J.neckH * (0.22 + i * 0.28), 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[J.neckR * 0.9, J.neckR * 0.16, 10, 24]} />
          <meshStandardMaterial color={JOINT} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* the TV head: dark, a cream lid, the pink screen in front, dials on its side */}
      <group ref={head} position={[0, J.headY, 0]}>
        <Part args={[J.headW, J.headH, J.headD]} color={SHELL_DARK} metal={0.8} rough={0.7} r={0.025} />
        <Part args={[J.headW * 1.03, 0.06, J.headD * 1.03]} color={SHELL} position={[0, J.headH / 2 + 0.03, 0]} r={0.02} />
        <mesh ref={face} position={[FACE.x, FACE.y, J.headD / 2 + 0.006]}>
          <planeGeometry args={[FACE.w, FACE.h]} />
          <meshBasicMaterial ref={faceMat} map={tex} toneMapped={false} />
        </mesh>
        <Dial position={[-J.headW / 2 - 0.012, 0.05, -0.02]} />
        <Dial position={[-J.headW / 2 - 0.012, -0.06, -0.02]} />
        {[-0.06, 0.06].map((x) => (
          <group key={x} position={[x, J.headH / 2 + 0.06, -0.03]} rotation={[-0.15, 0, x > 0 ? -0.12 : 0.1]}>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.007, 0.007, 0.2, 6]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0, 0.205, 0]}>
              <sphereGeometry args={[0.016, 10, 10]} />
              <meshStandardMaterial color="#2a2b3a" />
            </mesh>
          </group>
        ))}
        <pointLight position={[0, 0, 0.35]} color="#ff9ebb" intensity={awake ? 0.35 : 0} distance={1} decay={2} />
      </group>
    </group>
  );
}

// The robot's keyboard: a chunky white board, lavender caps, dark accents, a knob.
function Keyboard(props) {
  const light = useRef();
  const dark = useRef();
  const u = 0.032;
  const keys = useMemo(() => {
    const list = [];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 15; c++) {
        if (r === 5 && c > 3 && c < 10) continue;
        const accent = c === 14 || (r === 0 && c === 0) || (r === 5 && c >= 10) || (r === 4 && c === 13);
        list.push({ x: -0.224 + c * u, z: -0.08 + r * u, accent });
      }
    }
    return list;
  }, []);
  useEffect(() => {
    const m = new THREE.Matrix4();
    let li = 0;
    let di = 0;
    keys.forEach((k) => {
      m.makeTranslation(k.x, 0.034, k.z);
      if (k.accent) dark.current.setMatrixAt(di++, m);
      else light.current.setMatrixAt(li++, m);
    });
    light.current.count = li;
    dark.current.count = di;
    light.current.instanceMatrix.needsUpdate = true;
    dark.current.instanceMatrix.needsUpdate = true;
  }, [keys]);
  return (
    <group {...props}>
      <Part args={[0.5, 0.034, 0.21]} color="#e3e0ea" position={[0, 0.017, 0]} r={0.01} />
      <instancedMesh ref={light} args={[null, null, keys.length]} castShadow>
        <boxGeometry args={[0.027, 0.016, 0.027]} />
        <meshStandardMaterial color="#cbc9e0" roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={dark} args={[null, null, keys.length]} castShadow>
        <boxGeometry args={[0.027, 0.016, 0.027]} />
        <meshStandardMaterial color="#3a2e34" roughness={0.5} />
      </instancedMesh>
      <Box args={[0.186, 0.016, 0.027]} position={[-0.224 + u * 6.5, 0.034, -0.08 + u * 5]} color="#cbc9e0" rough={0.5} />
      <mesh position={[0.226, 0.046, -0.08]}>
        <cylinderGeometry args={[0.014, 0.014, 0.022, 20]} />
        <meshStandardMaterial color="#141418" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

// A white ergonomic mouse with a lilac light strip.
function Mouse(props) {
  return (
    <group {...props}>
      <mesh position={[0, 0.024, 0]} scale={[0.62, 0.38, 1]} castShadow>
        <sphereGeometry args={[0.075, 24, 16]} />
        <meshStandardMaterial color="#e6e5ee" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.03, 0.015]} scale={[0.64, 0.32, 0.9]}>
        <torusGeometry args={[0.07, 0.003, 6, 32, Math.PI]} />
        <meshBasicMaterial color={[1.2, 1.4, 2.4]} toneMapped={false} />
      </mesh>
      <Box args={[0.008, 0.01, 0.022]} position={[0, 0.05, -0.03]} color="#2a2b3a" />
    </group>
  );
}

// A flat rounded rectangle whose UVs span 0..1, so a texture fills it.
function roundedPlane(w, h, r) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 12);
  const pos = g.attributes.position;
  const uv = [];
  for (let i = 0; i < pos.count; i++) uv.push((pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const IPHONE_FRAME = '#c8bcd8'; // Purple
const IPHONE_GLASS = '#ddd2ea';

function Phone({ open }) {
  const flip = useRef();
  const angle = useRef(Math.PI);
  const [tex, redraw] = useCanvas(360, 776, drawPhone);
  useEffect(() => {
    const id = setInterval(() => redraw(), 20000);
    return () => clearInterval(id);
  }, [redraw]);
  const { w, h, t, r, sw, sh } = IPHONE;
  const geo = useMemo(() => {
    const body = new THREE.ExtrudeGeometry(rrShape(w, h, r), { depth: t, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0007, bevelSegments: 3, curveSegments: 16 });
    body.translate(0, 0, -t / 2);
    return {
      body,
      front: roundedPlane(w - 0.0016, h - 0.0016, r - 0.0008),
      back: roundedPlane(w - 0.002, h - 0.002, r - 0.001),
      screen: roundedPlane(sw, sh, r - 0.003),
      bump: new THREE.ExtrudeGeometry(rrShape(0.031, 0.031, 0.007), { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 2 }),
    };
  }, [w, h, t, r, sw, sh]);

  // Face down on the desk (its back and cameras up); it flips over, lifting as it turns.
  useFrame((_, dt) => {
    const goal = open ? 0 : Math.PI;
    angle.current += (goal - angle.current) * (1 - Math.exp(-dt * 4.5));
    flip.current.rotation.y = angle.current;
    flip.current.position.z = Math.sin(angle.current) * 0.06;
  });

  const lens = (x, y) => (
    <group position={[x, y, -0.0014]}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.0058, 0.0058, 0.0016, 24]} />
        <meshStandardMaterial color="#14141a" metalness={0.6} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0, -0.0009]}>
        <torusGeometry args={[0.0058, 0.0007, 8, 24]} />
        <meshStandardMaterial color={IPHONE_FRAME} metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, -0.00085]} rotation-y={Math.PI}>
        <circleGeometry args={[0.0028, 20]} />
        <meshStandardMaterial color="#2a2a5a" metalness={0.9} roughness={0.05} />
      </mesh>
    </group>
  );
  const bx = w / 2 - 0.0185;
  const by = h / 2 - 0.0185;
  return (
    <group position={PHONE.pos} rotation={[PHONE.tilt, PHONE.rotY, 0, 'YXZ']} scale={PHONE.scale}>
      <group ref={flip}>
        <mesh geometry={geo.body}>
          <meshStandardMaterial color={IPHONE_FRAME} metalness={0.7} roughness={0.28} />
        </mesh>
        {/* front glass and the screen */}
        <mesh geometry={geo.front} position-z={t / 2 + 0.0002}>
          <meshStandardMaterial color="#050507" roughness={0.1} metalness={0.2} />
        </mesh>
        <mesh geometry={geo.screen} position-z={t / 2 + 0.0004}>
          <meshBasicMaterial map={tex} transparent toneMapped={false} />
        </mesh>
        {/* back glass, camera bump with two diagonal lenses and the flash */}
        <mesh geometry={geo.back} position-z={-t / 2 - 0.0002} rotation-y={Math.PI}>
          <meshStandardMaterial color={IPHONE_GLASS} roughness={0.35} metalness={0.1} />
        </mesh>
        <group position={[bx, by, -t / 2 - 0.0002]}>
          <mesh geometry={geo.bump} rotation-y={Math.PI} position={[0, 0, 0]}>
            <meshStandardMaterial color="#d3c8e2" roughness={0.2} metalness={0.2} />
          </mesh>
          {lens(0.0072, 0.0072)}
          {lens(-0.0072, -0.0072)}
          <mesh position={[-0.0078, 0.0078, -0.0017]} rotation-y={Math.PI}>
            <circleGeometry args={[0.0022, 16]} />
            <meshStandardMaterial color="#f4ecd8" emissive="#3a3020" />
          </mesh>
        </group>
        {/* side buttons: power on the right; action switch and volume on the left */}
        <Box args={[0.0012, 0.017, 0.0034]} position={[w / 2 + 0.0004, 0.022, 0]} color={IPHONE_FRAME} metal={0.7} rough={0.3} />
        <Box args={[0.0012, 0.006, 0.0034]} position={[-w / 2 - 0.0004, 0.045, 0]} color={IPHONE_FRAME} metal={0.7} rough={0.3} />
        <Box args={[0.0012, 0.012, 0.0034]} position={[-w / 2 - 0.0004, 0.028, 0]} color={IPHONE_FRAME} metal={0.7} rough={0.3} />
        <Box args={[0.0012, 0.012, 0.0034]} position={[-w / 2 - 0.0004, 0.012, 0]} color={IPHONE_FRAME} metal={0.7} rough={0.3} />
      </group>
    </group>
  );
}

// A badge on its lanyard. It sways from the hook; docked on the board, the one in
// front settles, lifts toward you and turns over when clicked.
const tmpV = new THREE.Vector3();
function HangingBadge({ b, i, active, front, back, top }) {
  const { x, len } = badgeLocal(i);
  const swing = useRef();
  const card = useRef();
  const st = useRef({ lift: 0, flip: 0, kick: 0, wasFront: false });
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const s = st.current;
    const isFront = active && ui.badge === i;
    if (isFront && !s.wasFront) s.kick = 1; // a little swing as it comes forward
    s.wasFront = isFront;
    s.kick *= Math.exp(-dt * 1.6);
    const k = 1 - Math.exp(-dt * 6);
    s.lift += ((isFront ? 1 : 0) - s.lift) * k;
    s.flip += ((isFront && ui.flip ? Math.PI : 0) - s.flip) * (1 - Math.exp(-dt * 7));
    const sway = (0.035 * (1 - 0.8 * s.lift) + 0.09 * s.kick) * Math.sin(t * 1.6 + i * 1.7);
    swing.current.rotation.z = sway;
    swing.current.rotation.x = -0.12 * s.lift; // swings out from the board as it lifts
    swing.current.position.z = 0.07 + 0.09 * s.lift;
    card.current.rotation.y = s.flip;
    const sc = 1 + 0.12 * s.lift;
    card.current.scale.lerp(tmpV.set(sc, sc, 1), k);
  });
  const click = (e) => {
    if (!active) return;
    e.stopPropagation();
    if (ui.badge === i) ui.set({ flip: !ui.flip });
    else ui.set({ badge: i, flip: false });
  };
  return (
    <group>
      <Hook x={x} y={top} />
      <group ref={swing} position={[x, top - 0.03, 0.07]}>
        <Box args={[0.03, len, 0.004]} position={[0, -len / 2, 0]} color={b.color} rough={0.7} />
        <Box args={[0.02, 0.025, 0.008]} position={[0, -len, 0.004]} color="#a9abb6" metal={0.2} rough={0.6} />
        <group ref={card} position={[0, -len - 0.115, 0.006]} onClick={click}>
          <mesh castShadow>
            <planeGeometry args={[0.15, 0.21]} />
            <meshStandardMaterial map={front} roughness={0.45} transparent alphaTest={0.1} />
          </mesh>
          <mesh rotation-y={Math.PI} position-z={-0.002}>
            <planeGeometry args={[0.15, 0.21]} />
            <meshStandardMaterial map={back} roughness={0.45} transparent alphaTest={0.1} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// The coiled cable hanging from a hook: a loose helix flattened against the board.
function coilCurve() {
  const pts = [];
  for (let t = 0; t <= 1; t += 0.01) {
    const a = t * Math.PI * 2 * 3.2;
    pts.push(new THREE.Vector3(Math.sin(a) * 0.06, -t * 0.26 + Math.cos(a) * 0.015, 0.012 + Math.cos(a) * 0.01));
  }
  pts.push(new THREE.Vector3(-0.02, -0.31, 0.02), new THREE.Vector3(-0.03, -0.36, 0.02));
  return new THREE.CatmullRomCurve3(pts);
}

// [emoji, x, y, size] on the board (drawn units, centre origin)
const STICKERS = [
  ['🚀', -0.55, 0.3, 0.109], ['🎮', -0.2, 0.25, 0.116], ['👾', 0.12, 0.26, 0.109], ['🕹️', 0.34, 0.2, 0.102],
  ['❤️', -0.33, 0.1, 0.087], ['💬', 0.0, 0.12, 0.087], ['🏔️', -0.7, 0.14, 0.102], ['🚀', 0.67, 0.27, 0.087], ['📷', 0.86, 0.22, 0.116],
];

function Hook({ x, y }) {
  return (
    <group position={[x, y, 0.03]}>
      <Box args={[0.01, 0.05, 0.01]} color="#d8d8de" metal={0.8} rough={0.2} />
      <Box args={[0.01, 0.01, 0.04]} position={[0, -0.025, 0.02]} color="#d8d8de" metal={0.8} rough={0.2} />
      <Box args={[0.01, 0.025, 0.01]} position={[0, -0.015, 0.04]} color="#d8d8de" metal={0.8} rough={0.2} />
    </group>
  );
}

function Pegboard({ active }) {
  const W = 2.1;
  const H = 0.9;
  const { board, halo, badges, backs, stickers } = useMemo(() => {
    const out = {
      board: canvasTexture(1024, 440, drawPegboard),
      halo: canvasTexture(512, 300, drawHalo),
      badges: BADGES.map((b) => canvasTexture(256, 360, (g, w, h) => drawBadge(g, w, h, b))),
      backs: BADGES.map((b) => canvasTexture(256, 360, (g, w, h) => drawBadgeBack(g, w, h, b))),
      stickers: STICKERS.map(([e]) => canvasTexture(128, 128, (g, w, h) => drawSticker(g, w, h, e))),
    };
    // the photo and fonts arrive after the first draw: redraw the badges once they're in
    const redraw = () =>
      out.badges.forEach((t, i) => {
        drawBadge(t.image.getContext('2d'), 256, 360, BADGES[i]);
        t.needsUpdate = true;
        drawBadgeBack(out.backs[i].image.getContext('2d'), 256, 360, BADGES[i]);
        out.backs[i].needsUpdate = true;
      });
    if (PHOTO.complete) redraw();
    else PHOTO.addEventListener('load', redraw, { once: true });
    document.fonts?.ready.then(redraw);
    return out;
  }, []);
  const coil = useMemo(() => new THREE.TubeGeometry(coilCurve(), 220, 0.006, 6, false), []);
  const top = H / 2 - 0.05;
  return (
    <group position={BOARD.pos} scale={[BOARD.w / W, BOARD.h / H, 1]}>
      {/* the light behind: a halo on the wall, an LED strip round the back of the board */}
      <mesh position={[0, 0, -0.008]} scale={[1.16, 1.42, 1]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={halo} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Glow args={[W - 0.06, 0.012, 0.012]} position={[0, H / 2 - 0.03, 0.02]} color={[3, 2.4, 2.8]} />
      <Glow args={[W - 0.06, 0.012, 0.012]} position={[0, -H / 2 + 0.03, 0.02]} color={[3, 2.4, 2.8]} />
      <Glow args={[0.012, H - 0.06, 0.012]} position={[-W / 2 + 0.03, 0, 0.02]} color={[3, 2.4, 2.8]} />
      <Glow args={[0.012, H - 0.06, 0.012]} position={[W / 2 - 0.03, 0, 0.02]} color={[3, 2.4, 2.8]} />
      <pointLight position={[0, 0, 0.03]} color="#ffd2e6" intensity={0.6} distance={1.2} decay={2} />
      {/* the board: a panel standing off the wall, in front of its light */}
      <mesh position={[0, 0, 0.06]} castShadow receiveShadow>
        <boxGeometry args={[W, H, 0.025]} />
        <meshStandardMaterial color="#1a1c2c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.0726]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={board} roughness={0.8} />
      </mesh>
      <pointLight position={[0, 0.3, 1.4]} color="#f3e6ff" intensity={0.6} distance={2.6} decay={2} />
      <group position={[0, 0, 0.045]}>
        {BADGES.map((b, i) => (
          <HangingBadge key={b.org} b={b} i={i} active={active} front={badges[i]} back={backs[i]} top={top} />
        ))}
        {STICKERS.map(([, x, y, sz], i) => (
          <mesh key={i} position={[x, y, 0.032]} rotation-z={(((i * 53) % 7) - 3) * 0.06}>
            <planeGeometry args={[sz, sz]} />
            <meshStandardMaterial map={stickers[i]} transparent alphaTest={0.1} roughness={0.4} />
          </mesh>
        ))}
        {/* a keychain on a hook */}
        <Hook x={0.88} y={0.05} />
        <mesh position={[0.88, -0.01, 0.08]}>
          <torusGeometry args={[0.022, 0.004, 8, 20]} />
          <meshStandardMaterial color="#d8d8de" metalness={0.9} roughness={0.2} />
        </mesh>
        <Box args={[0.05, 0.065, 0.006]} position={[0.88, -0.08, 0.08]} color="#c27b2c" />
        {/* the coiled cable */}
        <Hook x={0.6} y={0.02} />
        <mesh geometry={coil} position={[0.6, -0.01, 0.06]}>
          <meshStandardMaterial color="#2a2e4a" roughness={0.5} />
        </mesh>
        {[-0.02, 0.025].map((dx) => (
          <Box key={dx} args={[0.012, 0.035, 0.012]} position={[0.6 + dx, -0.39, 0.08]} color="#d8d8de" metal={0.7} rough={0.3} />
        ))}
      </group>
    </group>
  );
}

function Cabinet() {
  const rings = useRef([]);
  useFrame(({ clock }) => {
    const l = audio.level(clock.elapsedTime);
    const idle = 0.04 + Math.sin(clock.elapsedTime * 2) * 0.02;
    rings.current.forEach((r, i) => {
      if (!r) return;
      const v = 1 + (audio.playing ? l * (0.4 + i * 0.18) : idle * (i + 1));
      r.scale.setScalar(v);
      r.material.color.setRGB(1.6 + l * 2.5, 0.8 + l, 1.2 + l * 1.6);
    });
  });
  const { w, h, d } = CABINET;
  const sx = SPEAKER.pos[0] - CABINET.pos[0];
  return (
    <group position={CABINET.pos}>
      {/* a low dark-wood cabinet with two doors and brass handles */}
      <Box args={[w, h - 0.06, d]} position={[0, 0.06 + (h - 0.06) / 2, 0]} color="#1f1e29" rough={0.55} />
      <Box args={[w + 0.02, 0.02, d + 0.02]} position={[0, h, 0]} color="#2a2936" />
      <Box args={[0.004, h - 0.12, 0.004]} position={[0, 0.06 + (h - 0.06) / 2, d / 2 + 0.002]} color="#0c0c12" />
      <Box args={[0.018, 0.12, 0.018]} position={[-0.045, 0.36, d / 2 + 0.01]} color="#c9a86a" metal={0.85} rough={0.25} />
      <Box args={[0.018, 0.12, 0.018]} position={[0.045, 0.36, d / 2 + 0.01]} color="#c9a86a" metal={0.85} rough={0.25} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => (
        <Box key={`${a}${b}`} args={[0.035, 0.06, 0.035]} position={[a * (w / 2 - 0.05), 0.03, b * (d / 2 - 0.05)]} color="#0c0c12" />
      ))}
      {/* the speaker: tall, a big woofer with pulsing rings, a tweeter and a little display */}
      <group position={[sx, SPEAKER.pos[1], SPEAKER.pos[2] - CABINET.pos[2]]}>
        <RoundedBox args={[SPEAKER.w, SPEAKER.h, SPEAKER.d]} radius={0.015} smoothness={2}>
          <meshStandardMaterial color="#6e717c" roughness={0.55} metalness={0.15} />
        </RoundedBox>
        <mesh position={[0, -0.07, SPEAKER.d / 2 + 0.001]}>
          <circleGeometry args={[0.115, 40]} />
          <meshStandardMaterial color="#3a3a46" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.07, SPEAKER.d / 2 + 0.002]}>
          <circleGeometry args={[0.045, 24]} />
          <meshStandardMaterial color="#1b1b22" />
        </mesh>
        {[0.125, 0.155].map((r, i) => (
          <mesh key={r} ref={(el) => (rings.current[i] = el)} position={[0, -0.07, SPEAKER.d / 2 + 0.003 + i * 0.001]}>
            <ringGeometry args={[r, r + 0.01, 48]} />
            <meshBasicMaterial color={[1.8, 0.9, 1.3]} toneMapped={false} transparent opacity={0.85} />
          </mesh>
        ))}
        <mesh position={[0, 0.13, SPEAKER.d / 2 + 0.001]}>
          <circleGeometry args={[0.03, 20]} />
          <meshStandardMaterial color="#3a3a46" metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.2, SPEAKER.d / 2 + 0.001]}>
          <planeGeometry args={[0.1, 0.03]} />
          <meshBasicMaterial color={[0.6, 1.4, 0.9]} toneMapped={false} />
        </mesh>
      </group>
      {/* DJ controller */}
      <group position={[0.3, h + 0.035, 0]}>
        <Box args={[0.52, 0.05, 0.34]} color="#101015" rough={0.4} />
        {[-0.15, 0.15].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.03, 0.02]}>
              <cylinderGeometry args={[0.085, 0.085, 0.012, 32]} />
              <meshStandardMaterial color="#1d1d26" metalness={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[x, 0.037, 0.02]}>
              <torusGeometry args={[0.085, 0.004, 6, 32]} />
              <meshStandardMaterial color="#9a9aa6" metalness={0.8} />
            </mesh>
          </group>
        ))}
        {[-0.025, 0, 0.025].map((x) => (
          <mesh key={x} position={[x, 0.035, -0.07]}>
            <cylinderGeometry args={[0.01, 0.01, 0.02, 10]} />
            <meshStandardMaterial color="#cfcbd6" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// If a model file fails, the room carries on without it rather than going blank.
class Optional extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}

function Model(props) {
  return (
    <Optional>
      <LoadedModel {...props} />
    </Optional>
  );
}

// A CC0 model from Poly Haven, scaled, with shadows on.
function LoadedModel({ name, scale = 1, ...props }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/${name}/${name}.gltf`);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  }, [scene]);
  return <primitive object={obj} scale={scale} {...props} />;
}

function Sofa() {
  return <Model name="sofa_03" scale={1.35} position={[4.75, 0, -0.6]} rotation-y={-Math.PI / 2} />;
}

function Plants() {
  return (
    <>
      <Model name="potted_plant_02" scale={4.2} position={[4.6, 0, -3.7]} rotation-y={0.6} />
    </>
  );
}

function Couch() {
  const c = '#5d6177';
  return (
    <group position={[4.65, 0, -0.6]}>
      <RoundedBox args={[0.95, 0.42, 2.1]} radius={0.06} smoothness={3} position={[0, 0.25, 0]}><meshStandardMaterial color={c} roughness={0.95} /></RoundedBox>
      <RoundedBox args={[0.3, 0.6, 2.1]} radius={0.08} smoothness={3} position={[0.33, 0.66, 0]}><meshStandardMaterial color={c} roughness={0.95} /></RoundedBox>
      {[-1, 1].map((sd) => (
        <RoundedBox key={sd} args={[0.95, 0.58, 0.2]} radius={0.07} smoothness={3} position={[0, 0.33, sd * 1.0]}><meshStandardMaterial color={c} roughness={0.95} /></RoundedBox>
      ))}
      {[-0.46, 0.46].map((z) => (
        <RoundedBox key={z} args={[0.66, 0.14, 0.9]} radius={0.06} smoothness={3} position={[-0.08, 0.52, z]}><meshStandardMaterial color="#686c84" roughness={0.95} /></RoundedBox>
      ))}
    </group>
  );
}

function Monstera({ position, scale = 1 }) {
  const leaves = useMemo(() => {
    const rnd = seeded(19);
    return Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2 + rnd() * 0.4;
      const h = 0.5 + rnd() * 0.65;
      const r = 0.22 + rnd() * 0.25;
      return { pos: [Math.cos(a) * r, h, Math.sin(a) * r], rot: [0.6 * Math.sin(a), -a, 0.6 * Math.cos(a)] };
    });
  }, []);
  return (
    <group position={position} scale={scale}>
      {leaves.map((l, i) => (
        <group key={i}>
          <Limb from={[0, 0.05, 0]} to={l.pos} size={0.014} color="#2f5a3a" />
          <mesh position={l.pos} rotation={l.rot} scale={[1, 0.06, 0.75]}>
            <sphereGeometry args={[0.2, 14, 10]} />
            <meshStandardMaterial color={i % 3 ? '#2f6b44' : '#3a7a50'} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function PlantStand() {
  return (
    <group position={[4.5, 0, -3.6]}>
      {[[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]].map(([x, z]) => (
        <Limb key={`${x}${z}`} from={[x * 1.3, 0, z * 1.3]} to={[x, 0.5, z]} size={0.03} color="#6b4a2f" />
      ))}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.03, 20]} />
        <meshStandardMaterial color="#6b4a2f" />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.2, 0.16, 0.34, 24]} />
        <meshStandardMaterial color="#e8e6e2" roughness={0.6} />
      </mesh>
      <Monstera position={[0, 0.8, 0]} scale={1.15} />
    </group>
  );
}

function Beanbag() {
  const dog = useRef();
  useFrame(({ clock }) => {
    dog.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.025; // asleep, breathing
  });
  const fur = '#f3f1ee';
  const ear = '#d9c3a6';
  return (
    <group position={[-3.95, 0, -1.75]}>
      <mesh position={[0, 0.36, 0]} scale={[1, 0.56, 1]}>
        <sphereGeometry args={[0.66, 40, 28]} />
        <meshStandardMaterial color="#f29bb8" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]}>
        <torusGeometry args={[0.52, 0.045, 10, 48]} />
        <meshStandardMaterial color="#f5f0f2" roughness={0.8} />
      </mesh>
      {/* a white dog, curled up asleep */}
      <group ref={dog} position={[0.05, 0.72, 0.08]} rotation-y={0.9}>
        <mesh scale={[1.4, 0.62, 1]}>
          <sphereGeometry args={[0.16, 24, 18]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        <mesh position={[0.17, 0.03, 0.09]}>
          <sphereGeometry args={[0.095, 20, 16]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        <mesh position={[0.25, 0.0, 0.14]} scale={[1, 0.8, 1]}>
          <sphereGeometry args={[0.045, 14, 12]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        <mesh position={[0.29, 0.01, 0.16]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color="#1b1b22" />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[0.15, 0.04, 0.09 + sd * 0.08]} rotation={[sd * 0.5, 0, 0.3]} scale={[0.5, 0.22, 1]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color={ear} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[-0.2, 0.0, 0.08]} rotation={[Math.PI / 2, 0, 0.6]}>
          <torusGeometry args={[0.06, 0.02, 8, 14, Math.PI]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/* ================= interaction ================= */

function Diamond({ position }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 2 + position[0]) * 0.03;
    ref.current.rotation.y = t * 0.8;
  });
  return (
    <mesh ref={ref} position={position} scale={[0.75, 1.3, 0.75]}>
      <octahedronGeometry args={[0.06, 0]} />
      <meshBasicMaterial color={[2.6, 1.15, 1.6]} toneMapped={false} />
    </mesh>
  );
}

function Prop({ k, live, onOpen, marker, children }) {
  const hovered = useRef(false);
  const over = (e) => {
    if (!live) return;
    e.stopPropagation();
    if (!hovered.current) blip(560);
    hovered.current = true;
    ui.set({ label: TITLES[k] });
  };
  const out = () => {
    hovered.current = false;
    ui.set({ label: null });
  };
  const click = (e) => {
    if (!live || pointer.moved > 6) return;
    e.stopPropagation();
    out();
    onOpen(k);
  };
  return (
    <group onPointerOver={over} onPointerOut={out} onClick={click}>
      {children}
      {live && <Diamond position={marker} />}
    </group>
  );
}

/* ================= scene ================= */

function Lights({ awake }) {
  const amb = useRef();
  const hemi = useRef();
  const fill = useRef();
  const woke = useRef(null);
  useFrame(({ clock }) => {
    if (awake && woke.current === null) woke.current = clock.elapsedTime;
    const s = woke.current === null ? 0.16 : 0.16 + 0.84 * smoothstep((clock.elapsedTime - woke.current - 2.3) / 2.3);
    amb.current.intensity = 0.55 * s;
    hemi.current.intensity = 0.45 * s;
    fill.current.intensity = 0.3 * s;
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.09} color="#6f6a90" />
      <hemisphereLight ref={hemi} args={['#a59ad8', '#1a1418', 0.07]} />
      <directionalLight ref={fill} position={[3, 5, 4]} intensity={0.05} color="#b9a8ff" />
    </>
  );
}

export default function Room({ target, live, track, awake, sheet, surfaces, onOpen, onArrive, onExplore }) {
  const common = { live, onOpen };
  return (
    <div className="scene-wrap">
      <Canvas dpr={[1, 1.75]} camera={{ fov: FOV, near: 0.02, far: 120, position: [6, 4, 6] }} gl={{ antialias: true }}>
        <color attach="background" args={['#2a2440']} />
        <fog attach="fog" args={['#b98394', 22, 80]} />
        <Lights awake={awake} />

        <CameraRig target={target} onArrive={onArrive} onExplore={onExplore} />
        <SurfacePlacer station={typeof target === 'string' && target !== 'intro' ? target : null} sheet={sheet} surfaces={surfaces} />

        <City />
        <Shell />
        <Window />
        <Shelf />
        <Desk />
        <Pendants />
        <Sofa />
        <Plants />
        <Beanbag />

        <Prop k="projects" {...common} marker={MARKERS.projects}>
          <Monitor />
        </Prop>
        <Prop k="about" {...common} marker={MARKERS.about}>
          <Robot awake={awake} track={track} />
        </Prop>
        <Prop k="contact" {...common} marker={MARKERS.contact}>
          <Phone open={target === 'contact'} />
        </Prop>
        <Prop k="experience" {...common} marker={MARKERS.experience}>
          <Pegboard active={target === 'experience'} />
        </Prop>
        <Prop k="music" {...common} marker={MARKERS.music}>
          <Cabinet />
        </Prop>

        <EffectComposer>
          <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1} luminanceSmoothing={0.25} />
          <Vignette offset={0.3} darkness={0.65} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
