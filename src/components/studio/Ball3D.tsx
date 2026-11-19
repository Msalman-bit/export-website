'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { footballPanels, panelGeometry } from './football';

export type BallLook = { primary: string; secondary: string; accent: string; logo: string | null; logoPlace: 'front' | 'side' | 'both' };

/* The 3D football: 32 curved panels on a dark seam core, studio light, slow turn (none under reduced
   motion), drag to look around. `onReady` hands back a function that returns the current frame as PNG. */
export function Ball3D({ look, onFail, onReady }: { look: BallLook; onFail: () => void; onReady: (snap: () => string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ mats: THREE.MeshPhysicalMaterial[]; kinds: ('pent' | 'hex')[]; front: number; side: number; back: number; render: () => void } | null>(null);

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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.35, 4.2);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-2.5, 3, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe8ff, 1.6); rim.position.set(2.5, 1.5, -3); scene.add(rim);

    const ball = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.985, 64, 48), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.8 }));
    ball.add(core);
    const panels = footballPanels();
    const mats: THREE.MeshPhysicalMaterial[] = [];
    panels.forEach((p) => {
      const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35, sheen: 0.2 });
      mats.push(m);
      ball.add(new THREE.Mesh(panelGeometry(p, 1, 0.035), m));
    });
    scene.add(ball);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.08; scene.add(shadow);

    // the front hexagon faces the camera: the one whose centre points most along +z
    const hexIdx = panels.map((p, i) => ({ i, p })).filter((x) => x.p.kind === 'hex');
    const best = (dir: THREE.Vector3) => hexIdx.reduce((a, b) => (b.p.center.dot(dir) > a.p.center.dot(dir) ? b : a)).i;
    const front = best(new THREE.Vector3(0, 0.15, 1));
    const side = best(new THREE.Vector3(1, 0, 0.2));
    const back = best(new THREE.Vector3(0, -0.1, -1));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.enableZoom = true; controls.minDistance = 3; controls.maxDistance = 6;
    controls.enableDamping = true;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const size = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(size); ro.observe(el); size();

    let raf = 0, last = performance.now(), visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const render = () => renderer.render(scene, camera);
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!visible) return;
      if (!still) ball.rotation.y += dt * 0.25;
      controls.update();
      render();
    };
    raf = requestAnimationFrame(tick);
    state.current = { mats, kinds: panels.map((p) => p.kind), front, side, back, render };
    onReady(() => { render(); return renderer.domElement.toDataURL('image/png'); });

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); }); } });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [onFail, onReady]);

  // colours and logo
  useEffect(() => {
    const st = state.current;
    if (!st) return;
    const logoPanels = look.logo ? (look.logoPlace === 'front' ? [st.front] : look.logoPlace === 'side' ? [st.side] : [st.front, st.back]) : [];
    let tex: THREE.Texture | null = null;
    if (look.logo) {
      tex = new THREE.TextureLoader().load(look.logo, () => st.render());
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    st.mats.forEach((m, i) => {
      const isLogo = logoPanels.includes(i);
      m.color.set(st.kinds[i] === 'pent' ? look.secondary : i % 7 === 3 ? look.accent : look.primary);
      if (isLogo && tex) { m.color.set(look.primary); m.map = makeLogoTexture(tex, look.primary); }
      else if (m.map) { m.map.dispose(); m.map = null; }
      m.needsUpdate = true;
    });
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
