// The home hero's 3D poster stack, drawn with three.js (set up following .claude/skills/threejs-skills).
// HeroFeature.tsx loads this module on demand, so three.js is never part of the first page load.
//
// The front card is drawn exactly over the page's own poster (which is then hidden), so switching to 3D
// changes nothing on screen. The next films then fan out behind it to the left, receding in depth.
// Moving on throws the front card off to the right while the next one comes forward. Dragging (mouse
// or touch) scrubs through the stack, clicking a card behind brings it forward, and the front card
// tilts toward the pointer under a soft highlight, like a focused poster on Apple TV.
//
// Cheap to run: unlit planes with one small shader (rounded corners, highlight) and a soft shadow plane
// per card, frames drawn only while something moves, and no frames at all while the hero is scrolled
// away or the tab is hidden.
import {
  CanvasTexture, Color, Group, Mesh, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, ShaderMaterial,
  SRGBColorSpace, Texture, Timer, Vector2, Vector4, WebGLRenderer,
} from 'three';
import { EASE, gsap } from '../motion/gsap';

export interface StackPoster { url: string; title: string }

export interface StackOptions {
  /** The .hero element (gets the `is-3d` class while the stack is showing). */
  hero: HTMLElement;
  /** Layer inside the hero that receives the canvas; it spans from the text column to the hero's right edge. */
  host: HTMLElement;
  /** The left column; the stage starts at its right edge so cards never pass under the headline. */
  textColumn: HTMLElement;
  /** The page's poster box. The front card is drawn exactly over it. */
  anchor: HTMLElement;
  /** The front film's link, which lies over the anchor: it can be dragged and tilts the card. */
  link: HTMLElement;
  /** Automatic moves wait while the pointer or keyboard focus is inside any of these. */
  pauseWithin: HTMLElement[];
  posters: StackPoster[];
  start: number;
  onChange: (index: number, byUser: boolean) => void;
  /** The 3D stack replaced the page's poster. */
  onReady: () => void;
  /** WebGL went away (GPU reset, too many contexts): the page should go back to its own poster. */
  onLost: () => void;
}

export interface StackHandle {
  step: (by: number) => void;
  setPlaying: (on: boolean) => void;
  destroy: () => void;
}

// ---------- the look, in world units (a card is 2 × 3, the posters' 2:3) ----------

const CARD_W = 2;
const CARD_H = 3;
const CORNER = 0.122; // the page poster's 14 px corner at 230 px wide
const FOV = 30; // a long lens: gentle perspective
/** Cards behind the front one: each is this much further left, back, up, and turned toward the middle. */
const BACK = { x: 1.05, z: 1.5, y: 0.1, turn: 0.18 };
/** The card leaving the front swings this far right, toward the viewer, turning away. */
const EXIT = { x: 2.8, z: 0.8, turn: 0.5 };
const SHADOW_PAD = 0.9;
const DWELL_MS = 5000;

const ROUNDED_BOX = /* glsl */ `
float roundedBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}`;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const f = (n: number) => n.toFixed(4);

const CARD_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec4 uvRect;        // crop to 2:3 like object-fit: cover (xy offset, zw scale)
uniform float loaded;       // 0 → 1 as the poster fades in over the blank card
uniform vec3 blank;
uniform float opacity;
uniform float dim;
uniform vec2 glare;         // highlight centre (uv)
uniform float glareStrength;
varying vec2 vUv;
${ROUNDED_BOX}
void main() {
  vec2 p = (vUv - 0.5) * vec2(${f(CARD_W)}, ${f(CARD_H)});
  float d = roundedBox(p, vec2(${f(CARD_W / 2)}, ${f(CARD_H / 2)}), ${f(CORNER)});
  float aa = fwidth(d);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  vec3 color = mix(blank, texture2D(map, uvRect.xy + vUv * uvRect.zw).rgb, loaded) * dim;
  float g = 1.0 - smoothstep(0.0, 0.9, length((vUv - glare) * vec2(1.0, 1.5)));
  color += glareStrength * g * g * 0.28;
  color += smoothstep(-2.0 * aa, -aa, d) * 0.014; // 1 px edge, like the page's 0.5 px white-12% inner border
  gl_FragColor = vec4(color, inside * opacity);
  #include <colorspace_fragment>
}`;

const SHADOW_FRAGMENT = /* glsl */ `
uniform float opacity;
varying vec2 vUv;
${ROUNDED_BOX}
void main() {
  vec2 p = (vUv - 0.5) * vec2(${f(CARD_W + 2 * SHADOW_PAD)}, ${f(CARD_H + 2 * SHADOW_PAD)});
  float d = roundedBox(p, vec2(${f(CARD_W / 2 - 0.05)}, ${f(CARD_H / 2 - 0.05)}), ${f(CORNER)});
  float a = 1.0 - smoothstep(-0.3, ${f(SHADOW_PAD)}, d);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * opacity * 0.55);
}`;

interface Card {
  group: Group;
  face: Mesh<PlaneGeometry, ShaderMaterial>;
  shadow: Mesh<PlaneGeometry, ShaderMaterial>;
  texture: Texture | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mod = (v: number, n: number) => ((v % n) + n) % n;

/** Sum of offsets up to `ancestor`: layout position, unaffected by transforms running on the page. */
function offsetIn(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = el; node && node !== ancestor; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
}

/**
 * A poster as an image WebGL may read. TMDB sends its CORS header only to requests that carry an Origin
 * and does not vary its caching on it, so a copy cached by the page's own <img> (no Origin) fails a CORS
 * check. If the cached copy is refused, the poster is fetched again past the cache. The image is decoded
 * from a same-origin blob, so it never taints the canvas.
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  let response: Response;
  try {
    response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  } catch {
    response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'reload' });
  }
  if (!response.ok) throw new Error(`poster ${response.status}`);
  const blobUrl = URL.createObjectURL(await response.blob());
  try {
    const img = new Image();
    img.src = blobUrl;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/** The title tile shown when a poster cannot be loaded (matches the page's .poster-letter tile). */
function letterTile(title: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 600;
  const g = canvas.getContext('2d')!;
  const fill = g.createLinearGradient(0, 0, 400, 600);
  fill.addColorStop(0, '#3a3a3c');
  fill.addColorStop(1, '#1c1c1e');
  g.fillStyle = fill;
  g.fillRect(0, 0, 400, 600);
  g.fillStyle = 'rgba(245, 245, 247, 0.55)';
  g.font = '700 170px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(title.trim().slice(0, 1), 200, 310);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Builds the stack and resolves once the front card is drawn over the page's poster (or rejects, and
 * the page keeps its own poster).
 */
export async function createPosterStack(o: StackOptions): Promise<StackHandle> {
  const n = o.posters.length;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  const timer = new Timer();
  timer.connect(document);
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const faceGeometry = new PlaneGeometry(CARD_W, CARD_H);
  const shadowGeometry = new PlaneGeometry(CARD_W + 2 * SHADOW_PAD, CARD_H + 2 * SHADOW_PAD);
  const cards: Card[] = o.posters.map(() => {
    const face = new Mesh(faceGeometry, new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: CARD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        map: { value: null },
        uvRect: { value: new Vector4(0, 0, 1, 1) },
        loaded: { value: 0 },
        blank: { value: new Color(0x2c2c2e) },
        opacity: { value: 1 },
        dim: { value: 1 },
        glare: { value: new Vector2(0.5, 0.5) },
        glareStrength: { value: 0 },
      },
    }));
    const shadow = new Mesh(shadowGeometry, new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: SHADOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: { opacity: { value: 1 } },
    }));
    shadow.position.set(0, -0.17, -0.06); // like the page's 0 20px 50px poster shadow
    const group = new Group();
    group.add(shadow, face);
    scene.add(group);
    return { group, face, shadow, texture: null };
  });

  // ---------- state ----------

  /** Position in the list: 3 = the fourth film is at the front; 3.5 = halfway to the next. */
  const state = { pos: o.start, spread: 0 };
  let current = o.start;
  let pxPerStep = 200;
  let dirty = true;
  let destroyed = false;
  let ready = false;
  let looping = false;
  let playing = true;
  let inView = true;
  let hovered = false;
  let focused = false;
  let autoTimer = 0;
  // Pointer over the front card: highlight, tilt and press, eased toward their targets every frame.
  const pointer = { hover: 0, hoverTo: 0, press: 0, pressTo: 0, tx: 0, ty: 0, txTo: 0, tyTo: 0, u: 0.5, v: 0.5 };
  const last = { pos: NaN, spread: NaN };
  let drag: { id: number; x0: number; y0: number; pos0: number; active: boolean; xs: { x: number; t: number }[] } | null = null;
  let suppressClick = false;

  // Cards behind fade out this far back (and never wrap around into view in a short list).
  const backLimit = Math.min(n - 1, 3.6);

  function layoutCards() {
    for (let i = 0; i < n; i++) {
      const { group, face, shadow } = cards[i];
      // Offset from the front: 0 front, 1, 2, … behind, down to -1 = thrown off to the right.
      const off = mod(i - state.pos + 1, n) - 1;
      let alpha: number;
      let turn: number;
      if (off >= 0) {
        const s = off * state.spread;
        group.position.set(-s * BACK.x, s * BACK.y, -s * BACK.z);
        turn = Math.min(s, 1) * BACK.turn;
        alpha = clamp(backLimit - off, 0, 1) * (off > 0 ? clamp(state.spread * 1.5, 0, 1) : 1);
      } else {
        const e = -off;
        group.position.set(e * EXIT.x, 0, e * EXIT.z);
        turn = -e * EXIT.turn;
        alpha = (1 - e) * (1 - e);
      }
      const focus = clamp(1 - Math.abs(off), 0, 1);
      group.rotation.set(pointer.ty * focus, turn + pointer.tx * focus, 0);
      group.scale.setScalar(1 + (0.03 * pointer.hover - 0.03 * pointer.press) * focus);
      group.visible = alpha > 0.002;
      const u = face.material.uniforms;
      u.opacity.value = alpha;
      u.dim.value = 1 - 0.17 * clamp(off, 0, 3);
      u.glare.value.set(pointer.u, pointer.v);
      u.glareStrength.value = pointer.hover * focus;
      shadow.material.uniforms.opacity.value = alpha;
    }
  }

  function frame(time: number) {
    timer.update(time);
    const k = 1 - Math.exp(-Math.min(timer.getDelta(), 0.1) * 12);
    let moving = false;
    for (const [key, to] of [['hover', 'hoverTo'], ['press', 'pressTo'], ['tx', 'txTo'], ['ty', 'tyTo']] as const) {
      const delta = pointer[to] - pointer[key];
      if (Math.abs(delta) > 1e-4) {
        pointer[key] += delta * k;
        moving = true;
      } else pointer[key] = pointer[to];
    }
    if (!dirty && !moving && state.pos === last.pos && state.spread === last.spread) return;
    dirty = false;
    last.pos = state.pos;
    last.spread = state.spread;
    layoutCards();
    renderer.render(scene, camera);
  }

  function updateLoop() {
    const run = !destroyed && inView && document.visibilityState === 'visible';
    if (run !== looping) renderer.setAnimationLoop(run ? frame : null);
    looping = run;
    if (run) dirty = true;
    schedule();
  }

  // ---------- layout: the front card sits exactly on the page's poster ----------

  function measure() {
    if (destroyed) return;
    const left = offsetIn(o.textColumn, o.hero).x + o.textColumn.offsetWidth;
    o.host.style.left = `${left}px`;
    const w = o.host.clientWidth;
    const h = o.host.clientHeight;
    const aw = o.anchor.offsetWidth;
    const ah = o.anchor.offsetHeight;
    if (!w || !h || !aw || !ah) return;
    const a = offsetIn(o.anchor, o.hero);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Far enough that the card's 3 units of height cover the poster's height in pixels…
    camera.position.set(0, 0, (CARD_H * h) / (2 * ah * Math.tan((FOV * Math.PI) / 360)));
    // …and the lens shifted (not turned) so the card's centre lands on the poster's centre.
    const cx = a.x - left + aw / 2;
    const cy = a.y + ah / 2;
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    pxPerStep = aw * 0.9;
    dirty = true;
    if (!looping) frame(performance.now());
  }

  // ---------- moving ----------

  function emit(byUser: boolean) {
    const i = mod(Math.round(state.pos), n);
    if (i !== current) {
      current = i;
      o.onChange(i, byUser);
    }
  }

  function schedule() {
    window.clearTimeout(autoTimer);
    if (destroyed || !ready || !playing || hovered || focused || drag || !inView || document.visibilityState !== 'visible') return;
    if (gsap.isTweening(state)) return; // scheduled again when the move ends
    autoTimer = window.setTimeout(() => settle(Math.round(state.pos) + 1, false, true), DWELL_MS);
  }

  function settle(target: number, byUser: boolean, auto = false) {
    window.clearTimeout(autoTimer);
    gsap.to(state, {
      pos: target,
      duration: auto ? 1.25 : 0.85,
      ease: auto ? 'power3.inOut' : EASE,
      overwrite: 'auto',
      onUpdate: () => emit(byUser),
      onComplete: schedule,
    });
  }

  // ---------- pointer: drag to scrub, click a card behind, tilt the front card ----------

  function cardAt(e: PointerEvent): number | null {
    const r = o.host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(cards.filter((c) => c.group.visible).map((c) => c.face), false);
    if (!hits.length) return null;
    const i = cards.findIndex((c) => c.face === hits[0].object);
    const off = mod(i - state.pos + 1, n) - 1;
    return off > 0.4 ? off : null;
  }

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || drag) return;
    suppressClick = false;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, pos0: state.pos, active: false, xs: [{ x: e.clientX, t: e.timeStamp }] };
    if (e.currentTarget === o.link) pointer.pressTo = 1;
  };

  const onMove = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.active) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { // a vertical swipe scrolls the page instead
          drag = null;
          pointer.pressTo = 0;
          return;
        }
        drag.active = true;
        pointer.pressTo = 0;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        gsap.killTweensOf(state, 'pos');
        window.clearTimeout(autoTimer);
        o.host.classList.add('is-dragging');
      }
      // Dragging right throws the front card off to the right, bringing the next one forward.
      state.pos = drag.pos0 + dx / pxPerStep;
      drag.xs.push({ x: e.clientX, t: e.timeStamp });
      while (drag.xs.length > 2 && e.timeStamp - drag.xs[0].t > 120) drag.xs.shift();
      emit(true);
      return;
    }
    if (e.pointerType === 'mouse' && e.currentTarget === o.host) {
      o.host.style.cursor = cardAt(e) === null ? '' : 'pointer';
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    pointer.pressTo = 0;
    o.host.classList.remove('is-dragging');
    if (d.active) {
      suppressClick = true;
      const first = d.xs[0];
      const v = (e.clientX - first.x) / Math.max(e.timeStamp - first.t, 1); // px per ms
      const target = Math.abs(v) > 0.3 ? (v > 0 ? Math.ceil(state.pos) : Math.floor(state.pos)) : Math.round(state.pos);
      settle(clamp(target, Math.round(d.pos0) - 4, Math.round(d.pos0) + 4), true);
    } else if (e.currentTarget === o.host && e.type === 'pointerup') {
      const off = cardAt(e);
      if (off !== null) settle(Math.round(state.pos + off), true);
    }
  };

  const onLinkClick = (e: MouseEvent) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const onTilt = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = o.anchor.getBoundingClientRect();
    const u = clamp((e.clientX - r.left) / r.width, 0, 1);
    const v = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    pointer.u = u;
    pointer.v = v;
    pointer.hoverTo = 1;
    pointer.txTo = (u - 0.5) * 0.22; // the side under the pointer dips away
    pointer.tyTo = -(v - 0.5) * 0.22;
    dirty = true;
  };
  const onTiltEnd = () => {
    pointer.hoverTo = 0;
    pointer.txTo = 0;
    pointer.tyTo = 0;
    pointer.pressTo = 0;
  };
  // Keyboard focus on the front film's link lifts its card, as hovering does.
  const onLinkFocus = () => {
    if (!o.link.matches(':focus-visible')) return;
    pointer.u = 0.5;
    pointer.v = 0.75;
    pointer.hoverTo = 1;
  };

  const noDrag = (e: DragEvent) => e.preventDefault();
  const setHovered = (on: boolean) => () => {
    hovered = on;
    schedule();
  };
  const onFocusIn = () => {
    focused = true;
    schedule();
  };
  const onFocusOut = (e: FocusEvent) => {
    focused = o.pauseWithin.some((el) => el.contains(e.relatedTarget as Node | null));
    schedule();
  };
  const onEnter = setHovered(true);
  const onLeave = setHovered(false);

  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];
  const on = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, opts);
    listeners.push([target, type, fn as EventListener, opts]);
  };
  for (const el of [o.host, o.link]) {
    on(el, 'pointerdown', onDown);
    on(el, 'pointermove', onMove);
    on(el, 'pointerup', onUp);
    on(el, 'pointercancel', onUp);
  }
  on(o.link, 'pointermove', onTilt);
  on(o.link, 'pointerleave', onTiltEnd);
  on(o.link, 'focus', onLinkFocus);
  on(o.link, 'blur', onTiltEnd);
  on(o.link, 'click', onLinkClick, { capture: true });
  on(o.link, 'dragstart', noDrag);
  for (const el of o.pauseWithin) {
    on(el, 'pointerenter', onEnter);
    on(el, 'pointerleave', onLeave);
    on(el, 'focusin', onFocusIn);
    on(el, 'focusout', onFocusOut);
  }
  on(document, 'visibilitychange', updateLoop);
  on(canvas, 'webglcontextlost', (e) => {
    e.preventDefault();
    o.onLost();
  });

  const seen = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateLoop();
  });
  seen.observe(o.hero);
  let resizeFrame = 0;
  const resized = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(measure);
  });
  resized.observe(o.hero);
  resized.observe(o.anchor);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    renderer.setAnimationLoop(null);
    looping = false;
    window.clearTimeout(autoTimer);
    cancelAnimationFrame(resizeFrame);
    gsap.killTweensOf(state);
    for (const c of cards) gsap.killTweensOf(c.face.material.uniforms.loaded);
    seen.disconnect();
    resized.disconnect();
    for (const [target, type, fn, opts] of listeners) target.removeEventListener(type, fn, opts);
    o.hero.classList.remove('is-3d');
    o.host.classList.remove('is-dragging');
    o.host.style.left = '';
    o.host.style.cursor = '';
    o.link.removeAttribute('draggable');
    for (const c of cards) {
      c.face.material.dispose();
      c.shadow.material.dispose();
      c.texture?.dispose();
    }
    faceGeometry.dispose();
    shadowGeometry.dispose();
    timer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  // ---------- posters ----------

  async function loadPoster(i: number, fade: boolean) {
    const card = cards[i];
    const { url, title } = o.posters[i];
    let texture: Texture;
    try {
      if (!url) throw new Error('no poster');
      const img = await loadImage(url);
      texture = new Texture(img);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;
      texture.needsUpdate = true;
      const aspect = img.naturalWidth / img.naturalHeight;
      const target = CARD_W / CARD_H;
      const sx = aspect > target ? target / aspect : 1;
      const sy = aspect > target ? 1 : aspect / target;
      card.face.material.uniforms.uvRect.value.set((1 - sx) / 2, (1 - sy) / 2, sx, sy);
    } catch {
      texture = letterTile(title);
    }
    if (destroyed) {
      texture.dispose();
      return;
    }
    card.texture = texture;
    const u = card.face.material.uniforms;
    u.map.value = texture;
    if (fade) gsap.to(u.loaded, { value: 1, duration: 0.5, ease: 'power1.out', onUpdate: () => { dirty = true; } });
    else u.loaded.value = 1;
    dirty = true;
  }

  try {
    canvas.setAttribute('aria-hidden', 'true');
    o.host.append(canvas);
    measure();
    // The front poster and the two behind it before the swap; the rest fade in as they arrive.
    const nearest = Math.min(n, 3);
    await Promise.all(Array.from({ length: nearest }, (_, k) => loadPoster(mod(o.start + k, n), false)));
    if (destroyed) throw new Error('stopped');
    for (let k = nearest; k < n; k++) void loadPoster(mod(o.start + k, n), true);
    o.link.setAttribute('draggable', 'false');
    // Draw the front card, then swap it for the page's poster in the same frame.
    dirty = true;
    frame(performance.now());
    o.hero.classList.add('is-3d');
    ready = true;
    o.onReady();
    updateLoop();
    // The cards behind fan out from behind the front one.
    gsap.to(state, { spread: 1, duration: 1.4, ease: EASE, delay: 0.15, onComplete: schedule });
  } catch (error) {
    destroy();
    throw error;
  }

  return {
    step(by) {
      settle(Math.round(state.pos) + by, true);
    },
    setPlaying(on) {
      playing = on;
      schedule();
    },
    destroy,
  };
}
