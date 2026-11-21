'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { footballPanels, logoSpots, panelGeometry } from './football';
import { RUGBY, RUGBY_SPOTS, pimpleGrip, rugbyCoreGeometry, rugbyPanelGeometry } from './rugby';
import { FACE, addPoint, marks, newStroke, paintCube, rng, stampCube, type Brush, type Stroke, type Tool } from './paint';

export type BallLook = {
  primary: string; secondary: string; accent: string; logo: string | null; logoPlace: 'front' | 'side' | 'both';
  /** the football's 32 panel colours, in footballPanels() order (12 pentagons, then 20 hexagons) */
  panels?: string[];
  /** free paint on the football: strokes across the panels (printed artwork) */
  strokes?: Stroke[];
};

/* The 3D football, made to read as a real ball: 32 cushioned panels (their middles lifted, their edges rolled into
   the seams) in a synthetic-leather finish with a fine grain and a light clear coat, lit by a soft studio room so the
   coat picks up real reflections, over a soft contact shadow. It turns slowly (not under reduced motion) and the hand
   takes over to look around. With `onPaint` (the Colours step), the hand paints, by `tool`:
   - turn: a drag turns the ball, a tap or click on a panel paints it;
   - panel: a drag paints every panel it passes over (the ball holds still);
   - free: a drag draws a brush or spray stroke anywhere, across the seams (`onStroke` gets it when the finger lifts).
   A painted panel fills with its new colour in about 150ms and lifts a little for a moment; on a computer the panel
   under the pointer brightens. `onPaint(panel, n)` counts the panels of one drag from 0, so one drag is one Undo.
   `onReady` hands back a function that returns the current frame as PNG. `view` is how the ball first faces the
   viewer (a quaternion from the ball's frame to the view) and `onView` gets the view it was left at, so the Flat
   drawing and the 3D ball always show the same side when the two are switched. `shape` is the ball: the 32-panel
   football (also the futsal ball and the handball) or the four-panel rugby ball, which lies along its length with a
   pimpled grip. */
export function Ball3D({ look, onFail, onReady, onPaint, onStroke, tool = 'turn', brush, view, onView, shape = 'football' }: {
  look: BallLook; onFail: () => void; onReady: (snap: () => string) => void;
  onPaint?: (panel: number, n: number) => void; onStroke?: (stroke: Stroke) => void; tool?: Tool; brush?: Brush;
  view?: number[]; onView?: (q: number[], shape: 'football' | 'rugby') => void; shape?: 'football' | 'rugby';
}) {
  const viewRef = useRef(view);
  viewRef.current = view;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const host = useRef<HTMLDivElement>(null);
  const paintRef = useRef(onPaint);
  paintRef.current = onPaint;
  const strokeRef = useRef(onStroke);
  strokeRef.current = onStroke;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const brushRef = useRef<Brush>(brush ?? { colour: '#1b2a4a', size: 'm', kind: 'brush' });
  if (brush) brushRef.current = brush;
  const state = useRef<{
    mats: THREE.MeshPhysicalMaterial[]; meshes: THREE.Mesh[]; target: THREE.Color[]; pop: number[];
    front: number; side: number; back: number; render: () => void; still: boolean;
    redraw: (strokes: Stroke[]) => void; live: Stroke | null;
  } | null>(null);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      onFail();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    // a soft studio room for the reflections in the clear coat (built in code, no image to download)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.55;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.32, 4.4);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-2.6, 3.2, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xdcecff, 1.3); rim.position.set(2.6, 1.4, -3); scene.add(rim);

    // the ball sits in a turntable (the slow turn spins the table, so the ball keeps any view it starts from)
    const spin = new THREE.Group();
    const ball = new THREE.Group();
    spin.add(ball);
    if (viewRef.current?.length === 4) ball.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion(...(viewRef.current as [number, number, number, number])));
    // the seams: the dark core shows between the panels
    const rugby = shape === 'rugby';
    const core = new THREE.Mesh(rugby ? rugbyCoreGeometry() : new THREE.SphereGeometry(0.982, 64, 48), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }));
    ball.add(core);
    const grain = rugby ? pimpleGrip() : leatherGrain();
    // free paint: six canvases folded into a cube around the ball; every panel mixes the paint over its own colour
    // (looked up by direction from the centre, so a stroke runs across the seams without a break)
    const faces = Array.from({ length: 6 }, () => { const c = document.createElement('canvas'); c.width = c.height = FACE; return c; });
    const ctxs = faces.map((c) => c.getContext('2d')!);
    const paintTex = new THREE.CubeTexture(faces);
    paintTex.colorSpace = THREE.SRGBColorSpace;
    paintTex.premultiplyAlpha = true; // clean edges: no dark fringe where the paint fades out
    paintTex.generateMipmaps = false; paintTex.minFilter = THREE.LinearFilter;
    paintTex.needsUpdate = true;
    let dirty = false;
    const withPaint = (m: THREE.MeshPhysicalMaterial) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.paintMap = { value: paintTex };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vPaintDir;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintDir = position;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform samplerCube paintMap;\nvarying vec3 vPaintDir;')
          .replace('#include <color_fragment>', '#include <color_fragment>\n{ vec4 pt = texture(paintMap, normalize(vPaintDir)); diffuseColor.rgb = diffuseColor.rgb * (1.0 - pt.a) + pt.rgb; }');
      };
      m.customProgramCacheKey = () => 'ms-panel-paint';
    };
    const panels = rugby ? [] : footballPanels();
    const geometries = rugby ? [0, 1, 2, 3].map((k) => rugbyPanelGeometry(k)) : panels.map((p) => panelGeometry(p, 1, 0.032, 10, 0.016));
    const mats: THREE.MeshPhysicalMaterial[] = [];
    const meshes: THREE.Mesh[] = [];
    geometries.forEach((geo, i) => {
      // the football: a smooth synthetic leather with a light coat; the rugby ball: a grippier, less shiny outer
      const m = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: rugby ? 0.62 : 0.5, clearcoat: rugby ? 0.2 : 0.45, clearcoatRoughness: rugby ? 0.5 : 0.32,
        bumpMap: grain, bumpScale: rugby ? 1.4 : 0.6, emissive: 0xffffff, emissiveIntensity: 0,
      });
      withPaint(m);
      mats.push(m);
      const mesh = new THREE.Mesh(geo, m);
      mesh.userData.panel = i;
      meshes.push(mesh);
      ball.add(mesh);
    });
    scene.add(spin);
    // a soft contact shadow under the ball (a radial fade, not a hard disc)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(rugby ? 2.8 : 2.6, rugby ? 1.8 : 2.6), new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = rugby ? -(RUGBY.W + 0.06) : -1.06; scene.add(shadow);

    // the logo's panels, fixed on the ball
    const { front, side, back } = rugby ? RUGBY_SPOTS : logoSpots(panels);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.enableZoom = true; controls.minDistance = 3.2; controls.maxDistance = 6.5;
    controls.enableDamping = false; // no glide after the hand lets go: the ball stays exactly where it was left
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // the camera stands back far enough that the ball fills about 78% of the frame's narrower side, so it never
    // crowds the edges or the 3D / Flat switch (a tall phone frame is narrower than it is high)
    const size = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const fit = 1.02 / (0.78 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect));
      camera.position.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, fit)));
    };
    const ro = new ResizeObserver(size); ro.observe(el); size();

    // the hand: in Turn, a tap or click picks the panel under it and a drag turns the ball; with a brush, a drag
    // paints (one finger: a second finger is ignored until the first lifts)
    const ray = new THREE.Raycaster();
    const hitAt = (e: PointerEvent, targets: THREE.Object3D[]) => {
      const r = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, camera);
      return ray.intersectObjects(targets, false)[0];
    };
    const at = (e: PointerEvent): number => { const hit = hitAt(e, meshes); return hit ? (hit.object.userData.panel as number) : -1; };
    const mode = (): Tool => (paintRef.current ? toolRef.current : 'turn');
    let down: { x: number; y: number; t: number } | null = null;
    let drag: { id: number; n: number; last: number; stroke: Stroke | null; rnd: () => number } | null = null;
    let hover = -1;
    // the hand on the ball: a touch or a click held, or (on a computer) the mouse over it; the slow turn stops at
    // once and waits 0.75 s after the hand lets go or the mouse leaves; a mouse that rests on the ball without moving
    // for 2 s lets it turn again, and the next move stops it
    let held = false, hovering = false, resumeAt = 0, movedAt = 0;
    const PAUSE = 750, REST = 2000;
    const letGo = () => { resumeAt = performance.now() + PAUSE; };
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const paintAt = (e: PointerEvent) => {
      if (!drag) return;
      if (mode() === 'panel') {
        const i = at(e);
        if (i >= 0 && i !== drag.last) { drag.last = i; paintRef.current?.(i, drag.n++); }
        return;
      }
      const hit = hitAt(e, [...meshes, core]);
      if (!hit) return;
      const d = ball.worldToLocal(hit.point.clone()).normalize();
      if (!drag.stroke) { drag.stroke = newStroke(brushRef.current); drag.rnd = rng(drag.stroke.seed); }
      const st = drag.stroke;
      const k = addPoint(st, d);
      if (k < 0) return;
      marks(st, k, drag.rnd, (x, y, z, r, a) => stampCube(ctxs, st.colour, x, y, z, r, a));
      dirty = true;
    };
    // the fingers (or the mouse button) on the ball. A phone can lose a finger's lift (after a long press opens its own
    // menu, or when a call or a switch of app interrupts the touch): the page would go on counting that finger, so
    // the next single finger would zoom (two fingers) and the ball would never turn again. So a first finger, with no
    // other down, starts afresh: the lost fingers are forgotten here and in the turning control, and a brush stroke
    // left open is finished.
    const fingers = new Set<number>();
    const forgetLost = () => {
      fingers.clear();
      const oc = controls as unknown as { _pointers?: number[]; _pointerPositions?: Record<number, unknown> };
      if (oc._pointers?.length) { oc._pointers.length = 0; oc._pointerPositions = {}; }
      if (drag) {
        const st = drag.stroke;
        drag = null;
        if (st && st.pts.length && state.current) { state.current.live = st; strokeRef.current?.(st); }
      }
      down = null; held = false;
    };
    const onDown = (e: PointerEvent) => {
      if (e.isPrimary) forgetLost();
      controls.enabled = mode() === 'turn'; // before the turning control sees this touch (this listener runs first)
      fingers.add(e.pointerId);
      held = true;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (mode() === 'turn' || drag) return;
      e.preventDefault();
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* the drag still paints inside the frame */ }
      drag = { id: e.pointerId, n: 0, last: -1, stroke: null, rnd: rng(1) };
      paintAt(e);
    };
    const finish = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return false;
      if (e.type === 'pointerup') paintAt(e); // where the finger lifted is part of the stroke
      const st = drag.stroke;
      drag = null; down = null;
      if (st && st.pts.length && state.current) { state.current.live = st; strokeRef.current?.(st); }
      return true;
    };
    const lift = (e: PointerEvent) => { fingers.delete(e.pointerId); held = fingers.size > 0; if (!held) letGo(); };
    const onUp = (e: PointerEvent) => {
      lift(e);
      if (finish(e)) return;
      const d = down; down = null;
      if (!d || !paintRef.current || mode() !== 'turn') return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 500) return;
      const i = at(e);
      if (i >= 0) paintRef.current(i, 0);
    };
    const onCancel = (e: PointerEvent) => { lift(e); finish(e); down = null; };
    // leaving the page mid-touch (a call, another app) lifts every finger
    const onHide = () => { if (document.hidden) { forgetLost(); letGo(); } };
    // no long-press menu on the ball (it is what most often swallows a finger's lift)
    const noMenu = (e: Event) => e.preventDefault();
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') { hovering = true; movedAt = performance.now(); }
      if (drag && e.pointerId === drag.id) { paintAt(e); return; }
      if (!fine || down) return;
      const m = mode();
      const i = paintRef.current && m !== 'free' ? at(e) : -1;
      hover = i;
      renderer.domElement.style.cursor = m === 'free' ? 'crosshair' : i >= 0 ? 'pointer' : m === 'panel' ? 'default' : 'grab';
    };
    const onLeave = (e: PointerEvent) => { hover = -1; if (e.pointerType === 'mouse' && hovering) { hovering = false; letGo(); } };
    renderer.domElement.addEventListener('pointerdown', onDown, { capture: true });
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onCancel);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('contextmenu', noMenu);
    document.addEventListener('visibilitychange', onHide);

    let raf = 0, last = performance.now(), visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const render = () => renderer.render(scene, camera);
    // the slow turn gives way to the hand: it stops the moment the ball is touched, clicked or (on a computer) under
    // the mouse, stays still 0.75 s after the hand lets go or the mouse leaves (or after 2 s of a mouse resting on it
    // without moving), then eases back in, never jumping to full speed. On the Colours step (painting) the ball never
    // turns by itself: it stays where the hand leaves it.
    const TURN = 0.25;
    let turn = still ? 0 : TURN;
    const target: THREE.Color[] = mats.map(() => new THREE.Color(0xffffff));
    const pop: number[] = mats.map(() => -1e9); // when each panel was last painted (performance.now())
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!visible) return;
      const painting = !!paintRef.current; // the Colours step
      controls.enabled = !painting || toolRef.current === 'turn'; // a brush paints where a drag would turn
      const pointing = hovering && t - movedAt < REST; // a mouse on the ball, still moving
      if (still || painting || held || pointing) turn = 0; // at once: the ball stays where the hand aims
      else turn += ((t < resumeAt ? 0 : TURN) - turn) * Math.min(1, dt * 1.5);
      spin.rotation.y += dt * turn;
      // paint fills in (about 150ms), the painted panel lifts 1.5% and settles (about 260ms)
      const k = still ? 1 : Math.min(1, dt * 22);
      mats.forEach((m, i) => {
        m.color.lerp(target[i], k);
        const age = (t - pop[i]) / 260;
        const s = still || age < 0 || age > 1 ? 1 : 1 + 0.015 * Math.sin(age * Math.PI);
        meshes[i].scale.setScalar(s);
        m.emissiveIntensity = fine && i === hover ? 0.06 : 0;
      });
      if (dirty) { paintTex.needsUpdate = true; dirty = false; }
      controls.update();
      render();
    };
    raf = requestAnimationFrame(tick);
    const redraw = (strokes: Stroke[]) => { paintCube(ctxs, strokes); dirty = true; };
    state.current = { mats, meshes, target, pop, front, side, back, render, still, redraw, live: null };
    // the picture for a download or an inquiry: always a sharp 1200px square from the current view, whatever shape the
    // frame on screen has (a phone's frame is wider than tall, and copying it into a square stretched the ball)
    onReady(() => {
      const pr = renderer.getPixelRatio(), dist = camera.position.length();
      renderer.setPixelRatio(1); renderer.setSize(1200, 1200, false);
      camera.aspect = 1; camera.updateProjectionMatrix();
      camera.position.setLength(1.02 / (0.78 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
      render();
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setPixelRatio(pr); size(); camera.position.setLength(dist); render();
      return url;
    });

    return () => {
      // the view the ball was left at, for the Flat drawing
      const vq = camera.quaternion.clone().invert().multiply(ball.getWorldQuaternion(new THREE.Quaternion()));
      onViewRef.current?.([vq.x, vq.y, vq.z, vq.w], shape);
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown, { capture: true });
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onCancel);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('visibilitychange', onHide);
      scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); }); } });
      grain.dispose(); paintTex.dispose(); scene.environment?.dispose(); pmrem.dispose(); room.dispose?.();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [onFail, onReady, shape]);

  // colours and logo: each panel eases to its colour (instantly the first time and under reduced motion)
  const first = useRef(true);
  const prev = useRef<string[]>([]);
  useEffect(() => {
    const st = state.current;
    if (!st) return;
    const colours = st.mats.map((_, i) => look.panels?.[i] ?? (shape === 'rugby' ? (i % 2 ? look.primary : look.accent) : i < 12 ? look.secondary : i % 7 === 3 ? look.accent : look.primary));
    const logoPanels = look.logo ? (look.logoPlace === 'front' ? [st.front] : look.logoPlace === 'side' ? [st.side] : [st.front, st.back]) : [];
    let tex: THREE.Texture | null = null;
    if (look.logo) {
      tex = new THREE.TextureLoader().load(look.logo, () => st.render());
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    const now = performance.now();
    st.mats.forEach((m, i) => {
      const colour = colours[i];
      st.target[i].set(colour);
      if (first.current || st.still) m.color.set(colour);
      else if (prev.current[i] && prev.current[i] !== colour) st.pop[i] = now;
      const isLogo = logoPanels.includes(i);
      if (m.map) { m.map.dispose(); m.map = null; }
      if (isLogo && tex) { m.map = makeLogoTexture(tex, colour); m.color.set('#ffffff'); st.target[i].set('#ffffff'); }
      m.needsUpdate = true;
    });
    prev.current = colours;
    first.current = false;
  }, [look, shape]);

  // free paint: a stroke just drawn is already on the cube; anything else (Undo, Start again, Clear, the first
  // showing) redraws every stroke
  const drawn = useRef<Stroke[]>([]);
  useEffect(() => {
    const st = state.current;
    if (!st) return;
    const list = look.strokes ?? [];
    const prevList = drawn.current;
    const justDrawn = list.length === prevList.length + 1 && prevList.every((x, i) => x === list[i]) && list[list.length - 1] === st.live;
    if (!justDrawn && (list.length || prevList.length || st.live)) st.redraw(list);
    st.live = null;
    drawn.current = list;
  }, [look.strokes, shape]);

  return <div ref={host} style={{ position: 'absolute', inset: 0 }} />;
}

/** The logo centred on the panel's colour, with a margin, so it reads as a print on that panel. */
function makeLogoTexture(src: THREE.Texture, ground: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = ground; g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const img = src.image as HTMLImageElement | undefined;
    if (!img || !img.width) return;
    const s = Math.min(300 / img.width, 300 / img.height);
    g.drawImage(img, 256 - (img.width * s) / 2, 256 - (img.height * s) / 2, img.width * s, img.height * s);
    tex.needsUpdate = true;
  };
  draw();
  if (!(src.image as HTMLImageElement | undefined)?.width) setTimeout(draw, 200);
  return tex;
}

/** A fine synthetic-leather grain for the panels' bump map: soft noise with small pores, drawn once (256px, tiled). */
function leatherGrain(): THREE.CanvasTexture {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const img = g.createImageData(n, n);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < n * n; i++) {
    const v = 128 + (rnd() - 0.5) * 34;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // pores: small dark specks
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 900; i++) { g.beginPath(); g.arc(rnd() * n, rnd() * n, 0.6 + rnd() * 1.1, 0, Math.PI * 2); g.fill(); }
  // soften
  g.filter = 'blur(0.6px)'; g.drawImage(c, 0, 0); g.filter = 'none';
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 2.2);
  return tex;
}

/** The contact shadow: a radial fade from a soft dark centre to nothing. */
function softShadow(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(0.45, 'rgba(0,0,0,0.28)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
