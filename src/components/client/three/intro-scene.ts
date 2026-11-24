// The intro's 3D ticket (loaded on demand by src/components/client/Intro.tsx). The logo's ticket
// (public/favicon.svg) extruded into a dark, glossy ticket with gold edges; its three bar-chart slots are cut
// through it and glowing amber bars rise inside them like a meter, while gold dust drifts up around it.
// It starts exactly over the flat logo on the overlay (same place, same size), lifts and turns into 3D, and on
// exit spins toward the camera.
//
// Sizes below are the logo's own units (its 64×64 viewBox): the ticket is 42 wide and 30 tall.
import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture,
  Color, DirectionalLight, ExtrudeGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Path,
  PerspectiveCamera, PMREMGenerator, PointLight, Points, PointsMaterial, Scene, Shape, SRGBColorSpace, Timer,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from '../motion/gsap';

const W = 42;
const H = 30;
const CORNER = 5;
const NOTCH = 6;
const DEPTH = 3.2;
const BEVEL = 0.7;
/** The bar-chart slots: left edge, right edge and height above the shared baseline (logo units, y up). */
const BARS = [
  { x0: -12, x1: -6, h: 6 },
  { x0: -3, x1: 3, h: 11 },
  { x0: 6, x1: 12, h: 16 },
];
const BASELINE = -8;
/** How much bigger the ticket grows once it has lifted off the logo. */
const LIFT = 2;
const FOV = 35;
const CAMERA_Z = 10;

export interface IntroScene {
  /** Spins the ticket toward the camera; resolves when it has gone. */
  exit(): Promise<void>;
  dispose(): void;
}

function roundedRect(path: Path, x0: number, y0: number, x1: number, y1: number, r: number) {
  path.moveTo(x0 + r, y0);
  path.lineTo(x1 - r, y0);
  path.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x1, y1 - r);
  path.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  path.lineTo(x0 + r, y1);
  path.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + r);
  path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
}

/** The ticket outline: rounded corners, a half-round notch in each side, and the three bar slots as holes. */
function ticketShape(): Shape {
  const x = W / 2;
  const y = H / 2;
  const s = new Shape();
  s.moveTo(-x + CORNER, y);
  s.lineTo(x - CORNER, y);
  s.absarc(x - CORNER, y - CORNER, CORNER, Math.PI / 2, 0, true);
  s.lineTo(x, NOTCH);
  s.absarc(x, 0, NOTCH, Math.PI / 2, Math.PI * 1.5, false);
  s.lineTo(x, -y + CORNER);
  s.absarc(x - CORNER, -y + CORNER, CORNER, 0, -Math.PI / 2, true);
  s.lineTo(-x + CORNER, -y);
  s.absarc(-x + CORNER, -y + CORNER, CORNER, -Math.PI / 2, -Math.PI, true);
  s.lineTo(-x, -NOTCH);
  s.absarc(-x, 0, NOTCH, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-x, y - CORNER);
  s.absarc(-x + CORNER, y - CORNER, CORNER, Math.PI, Math.PI / 2, true);
  for (const b of BARS) {
    const hole = new Path();
    roundedRect(hole, b.x0, BASELINE, b.x1, BASELINE + b.h, 0.9);
    s.holes.push(hole);
  }
  return s;
}

/** A soft round dot for the dust particles. */
function dotTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Starts the scene on `canvas` (full window), with the ticket over the flat logo `mark`. Returns null when
 * WebGL cannot start.
 */
export function createIntroScene(canvas: HTMLCanvasElement, mark: HTMLElement): IntroScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);

  // Reflections for the gold edges and the glossy face.
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;

  scene.add(new AmbientLight(0xfff3e0, 0.25));
  const key = new DirectionalLight(0xfff1dc, 2.4);
  key.position.set(3, 4, 6);
  scene.add(key);
  const rimLeft = new PointLight(0xff9a1f, 60, 30, 2);
  rimLeft.position.set(-4.5, 1.5, -2.5);
  scene.add(rimLeft);
  const rimRight = new PointLight(0xff6a00, 45, 30, 2);
  rimRight.position.set(4.5, -1.8, -2);
  scene.add(rimRight);

  // ---- the ticket ----
  const ticketGeometry = new ExtrudeGeometry(ticketShape(), {
    depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * 0.8, bevelSegments: 5, curveSegments: 28,
  });
  ticketGeometry.translate(0, 0, -DEPTH / 2);
  const face = new MeshPhysicalMaterial({ color: 0x17181d, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 });
  const gold = new MeshStandardMaterial({ color: 0xffb547, metalness: 1, roughness: 0.24 });
  const ticket = new Mesh(ticketGeometry, [face, gold]);

  // Bars sit in their slots, a little behind both faces, growing up from the baseline.
  const barGeometry = new BoxGeometry(1, 1, DEPTH + BEVEL * 2 - 0.3);
  barGeometry.translate(0, 0.5, 0);
  const glow = new MeshStandardMaterial({ color: 0xffa51f, emissive: new Color(0xff7a00), emissiveIntensity: 0.55, metalness: 0.1, roughness: 0.45 });
  const bars = BARS.map((b) => {
    const bar = new Mesh(barGeometry, glow);
    bar.position.set((b.x0 + b.x1) / 2, BASELINE, 0);
    bar.scale.set(b.x1 - b.x0 - 1, 0.001, 1);
    return bar;
  });

  const group = new Group();
  group.add(ticket, ...bars);
  scene.add(group);

  // ---- gold dust ----
  const small = window.innerWidth < 700;
  const COUNT = small ? 160 : 360;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const radius = new Float32Array(COUNT);
  const angle = new Float32Array(COUNT);
  const height = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const palette = [new Color(0xffd27a), new Color(0xffab40), new Color(0xff7f50), new Color(0xfff1c4)];
  for (let i = 0; i < COUNT; i++) {
    radius[i] = 1.1 + Math.random() * 3.2;
    angle[i] = Math.random() * Math.PI * 2;
    height[i] = -3.4 + Math.random() * 6.8;
    speed[i] = 0.18 + Math.random() * 0.5;
    const c = palette[i % palette.length];
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const dustGeometry = new BufferGeometry();
  const positionAttr = new BufferAttribute(positions, 3);
  dustGeometry.setAttribute('position', positionAttr);
  dustGeometry.setAttribute('color', new BufferAttribute(colors, 3));
  const dotMap = dotTexture();
  const dustMaterial = new PointsMaterial({
    size: small ? 0.075 : 0.06, map: dotMap, vertexColors: true, transparent: true, opacity: 0,
    depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true,
  });
  const dust = new Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // ---- placing the ticket over the logo ----
  const anchor = { x: 0, y: 0, scale: 1 };
  const fit = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const unitsPerPx = (2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360)) / h;
    const r = mark.getBoundingClientRect();
    // The logo's ticket is 42 of its 64 units wide and centred in it.
    anchor.scale = ((r.width * (W / 64)) * unitsPerPx) / W;
    anchor.x = (r.left + r.width / 2 - w / 2) * unitsPerPx;
    anchor.y = -(r.top + r.height / 2 - h / 2) * unitsPerPx;
  };
  fit();
  window.addEventListener('resize', fit);

  // ---- motion ----
  // Everything the timelines move; applied to the objects every frame.
  const s = { lift: 1, z: 0, rotX: 0, rotY: 0, idle: 0, spin: 0, dust: 0, swirl: 1, glow: 0.55 };
  const grow = BARS.map(() => ({ v: 0.001 }));

  const intro = gsap.timeline();
  intro
    .to(s, { lift: LIFT, z: 0.4, duration: 1.2, ease: 'expo.out' }, 0.05)
    .to(s, { rotX: 0.2, rotY: -0.55, duration: 1.3, ease: 'power3.out' }, 0.1)
    .to(s, { dust: 0.95, duration: 0.9, ease: 'power2.out' }, 0.2)
    .to(s, { idle: 1, duration: 1.2, ease: 'sine.inOut' }, 1);
  grow.forEach((g, i) => intro.to(g, { v: 1, duration: 0.85, ease: 'back.out(1.7)' }, 0.25 + i * 0.14));
  intro.to(s, { glow: 1.05, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.95);

  const timer = new Timer();
  timer.connect(document);
  let t = 0;
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.05);
    t += dt;

    const scale = anchor.scale * s.lift;
    group.scale.setScalar(scale);
    group.position.set(anchor.x, anchor.y + Math.sin(t * 1.4) * 0.06 * s.idle, s.z);
    group.rotation.set(s.rotX + Math.sin(t * 0.8) * 0.06 * s.idle, s.rotY + Math.sin(t * 0.7) * 0.35 * s.idle + s.spin, 0);
    BARS.forEach((b, i) => { bars[i].scale.y = Math.max(0.001, b.h * grow[i].v); });
    glow.emissiveIntensity = s.glow;

    dustMaterial.opacity = s.dust;
    for (let i = 0; i < COUNT; i++) {
      height[i] += speed[i] * dt * s.swirl;
      if (height[i] > 3.4) height[i] = -3.4;
      angle[i] += dt * 0.25 * s.swirl * (i % 2 ? 1 : -1);
      positions[i * 3] = anchor.x + Math.cos(angle[i]) * radius[i];
      positions[i * 3 + 1] = anchor.y + height[i];
      positions[i * 3 + 2] = Math.sin(angle[i]) * radius[i] * 0.6 - 0.5;
    }
    positionAttr.needsUpdate = true;

    renderer.render(scene, camera);
  });

  let disposed = false;
  return {
    exit() {
      intro.kill();
      return new Promise<void>((resolve) => {
        const out = gsap.timeline({ onComplete: resolve });
        // A bar still rising when the page is ready finishes rising instead of freezing half-way.
        grow.forEach((g, i) => { if (g.v < 1) out.to(g, { v: 1, duration: 0.35, ease: 'power2.out' }, i * 0.05); });
        out
          .to(s, { spin: s.spin + Math.PI * 2, duration: 0.85, ease: 'power3.in' }, 0)
          .to(s, { z: 6.5, lift: s.lift * 1.25, idle: 0, duration: 0.85, ease: 'power3.in' }, 0)
          .to(s, { glow: 1.6, swirl: 5, duration: 0.5, ease: 'power2.in' }, 0)
          .to(s, { dust: 0, duration: 0.45, ease: 'power1.in' }, 0.4);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gsap.killTweensOf(s);
      grow.forEach((g) => gsap.killTweensOf(g));
      intro.kill();
      window.removeEventListener('resize', fit);
      renderer.setAnimationLoop(null);
      timer.dispose();
      ticketGeometry.dispose();
      barGeometry.dispose();
      dustGeometry.dispose();
      face.dispose();
      gold.dispose();
      glow.dispose();
      dustMaterial.dispose();
      dotMap.dispose();
      env.dispose();
      pmrem.dispose();
      room.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
