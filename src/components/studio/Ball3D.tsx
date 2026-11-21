'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { footballPanels, panelGeometry } from './football';

export type BallLook = {
  primary: string; secondary: string; accent: string; logo: string | null; logoPlace: 'front' | 'side' | 'both';
  /** the football's 32 panel colours, in footballPanels() order (12 pentagons, then 20 hexagons) */
  panels?: string[];
};

/* The 3D football, made to read as a real ball: 32 cushioned panels (their middles lifted, their edges rolled into
   the seams) in a synthetic-leather finish with a fine grain and a light clear coat, lit by a soft studio room so the
   coat picks up real reflections, over a soft contact shadow. It turns slowly (not under reduced motion) and the hand
   takes over to look around. With `onPaint`, a tap or click on a panel (not a drag) paints it: the panel fills with
   its new colour in about 150ms and lifts a little for a moment; on a computer the panel under the pointer brightens.
   `onReady` hands back a function that returns the current frame as PNG. */
export function Ball3D({ look, onFail, onReady, onPaint }: {
  look: BallLook; onFail: () => void; onReady: (snap: () => string) => void; onPaint?: (panel: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const paintRef = useRef(onPaint);
  paintRef.current = onPaint;
  const state = useRef<{
    mats: THREE.MeshPhysicalMaterial[]; meshes: THREE.Mesh[]; target: THREE.Color[]; pop: number[];
    front: number; side: number; back: number; render: () => void; still: boolean;
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
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-2.6, 3.2, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xdcecff, 1.3); rim.position.set(2.6, 1.4, -3); scene.add(rim);

    const ball = new THREE.Group();
    // the seams: the dark core shows between the panels
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.982, 64, 48), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }));
    ball.add(core);
    const grain = leatherGrain();
    const panels = footballPanels();
    const mats: THREE.MeshPhysicalMaterial[] = [];
    const meshes: THREE.Mesh[] = [];
    panels.forEach((p, i) => {
      const m = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.32,
        bumpMap: grain, bumpScale: 0.6, emissive: 0xffffff, emissiveIntensity: 0,
      });
      mats.push(m);
      const mesh = new THREE.Mesh(panelGeometry(p, 1, 0.032, 10, 0.016), m);
      mesh.userData.panel = i;
      meshes.push(mesh);
      ball.add(mesh);
    });
    scene.add(ball);
    // a soft contact shadow under the ball (a radial fade, not a hard disc)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.06; scene.add(shadow);

    // the front hexagon faces the camera: the one whose centre points most along +z
    const hexIdx = panels.map((p, i) => ({ i, p })).filter((x) => x.p.kind === 'hex');
    const best = (dir: THREE.Vector3) => hexIdx.reduce((a, b) => (b.p.center.dot(dir) > a.p.center.dot(dir) ? b : a)).i;
    const front = best(new THREE.Vector3(0, 0.15, 1));
    const side = best(new THREE.Vector3(1, 0, 0.2));
    const back = best(new THREE.Vector3(0, -0.1, -1));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.enableZoom = true; controls.minDistance = 3.2; controls.maxDistance = 6.5;
    controls.enableDamping = true;
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

    // a tap or click picks the panel under it; a drag turns the ball and paints nothing
    const ray = new THREE.Raycaster();
    const at = (e: PointerEvent): number => {
      const r = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, camera);
      const hit = ray.intersectObjects(meshes, false)[0];
      return hit ? (hit.object.userData.panel as number) : -1;
    };
    let down: { x: number; y: number; t: number } | null = null;
    let hover = -1;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e: PointerEvent) => {
      const d = down; down = null;
      if (!d || !paintRef.current) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 500) return;
      const i = at(e);
      if (i >= 0) paintRef.current(i);
    };
    const onMove = (e: PointerEvent) => {
      if (!fine || !paintRef.current || down) return;
      const i = at(e);
      if (i === hover) return;
      hover = i;
      renderer.domElement.style.cursor = i >= 0 ? 'pointer' : 'grab';
    };
    const onLeave = () => { hover = -1; };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    let raf = 0, last = performance.now(), visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const render = () => renderer.render(scene, camera);
    // the slow turn gives way to the hand: it stops while the ball is held (the drag keeps its own momentum,
    // OrbitControls' damping) and eases back in 1.5 s after it is let go, never jumping to full speed; it also
    // rests while a panel is being painted, so the next panel stays where the finger expects it
    const TURN = 0.25;
    let held = false, resumeAt = 0, turn = still ? 0 : TURN;
    controls.addEventListener('start', () => { held = true; turn = 0; });
    controls.addEventListener('end', () => { held = false; resumeAt = performance.now() + 1500; });
    const target: THREE.Color[] = mats.map(() => new THREE.Color(0xffffff));
    const pop: number[] = mats.map(() => -1e9); // when each panel was last painted (performance.now())
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!visible) return;
      const painting = !!paintRef.current && t < Math.max(...pop) + 2500;
      const want = still || held || painting || t < resumeAt ? 0 : TURN;
      turn += (want - turn) * Math.min(1, dt * 1.5);
      ball.rotation.y += dt * turn;
      // paint fills in (about 150ms), the painted panel lifts 1.5% and settles (about 260ms)
      const k = still ? 1 : Math.min(1, dt * 22);
      mats.forEach((m, i) => {
        m.color.lerp(target[i], k);
        const age = (t - pop[i]) / 260;
        const s = still || age < 0 || age > 1 ? 1 : 1 + 0.015 * Math.sin(age * Math.PI);
        meshes[i].scale.setScalar(s);
        m.emissiveIntensity = fine && i === hover ? 0.06 : 0;
      });
      controls.update();
      render();
    };
    raf = requestAnimationFrame(tick);
    state.current = { mats, meshes, target, pop, front, side, back, render, still };
    onReady(() => { render(); return renderer.domElement.toDataURL('image/png'); });

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); }); } });
      grain.dispose(); scene.environment?.dispose(); pmrem.dispose(); room.dispose?.();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [onFail, onReady]);

  // colours and logo: each panel eases to its colour (instantly the first time and under reduced motion)
  const first = useRef(true);
  const prev = useRef<string[]>([]);
  useEffect(() => {
    const st = state.current;
    if (!st) return;
    const colours = st.mats.map((_, i) => look.panels?.[i] ?? (i < 12 ? look.secondary : i % 7 === 3 ? look.accent : look.primary));
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
  }, [look]);

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
