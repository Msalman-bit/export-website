'use client';
import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { footballPanels } from './football';
import type { BallLook } from './Ball3D';

/* The 2D views: the football as an orthographic drawing of the same 32 panels (the fallback when
   WebGL is missing), a goalkeeper or boxing glove, and a shirt. Pure SVG, so it also prints. */

type Props = { model: 'football' | 'glove' | 'jersey'; look: BallLook; label: string };

export const Flat = forwardRef<SVGSVGElement, Props>(function Flat({ model, look, label }, ref) {
  return (
    <svg ref={ref} viewBox="0 0 600 600" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="600" fill="#0d0e10" />
      <ellipse cx="300" cy="545" rx="190" ry="18" fill="#000" opacity=".45" />
      {model === 'football' ? <Ball look={look} /> : model === 'glove' ? <Glove look={look} /> : <Jersey look={look} />}
    </svg>
  );
});

function Ball({ look }: { look: BallLook }) {
  const shapes = useMemo(() => {
    const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.35, -0.5, 0.1));
    return footballPanels().map((p, i) => {
      const c = p.center.clone().applyMatrix4(rot);
      if (c.z < -0.05) return null;
      const pts = p.corners.map((v) => v.clone().lerp(p.center, 0.04).normalize().applyMatrix4(rot));
      const d = pts.map((v, k) => `${k ? 'L' : 'M'}${(300 + v.x * 230).toFixed(1)} ${(300 - v.y * 230).toFixed(1)}`).join(' ') + 'Z';
      return { d, kind: p.kind, i, depth: c.z, cx: 300 + c.x * 230, cy: 300 - c.y * 230 };
    }).filter(Boolean).sort((a, b) => a!.depth - b!.depth) as { d: string; kind: string; i: number; depth: number; cx: number; cy: number }[];
  }, []);
  const front = shapes.filter((s) => s.kind === 'hex').reduce((a, b) => (b.depth > a.depth ? b : a), shapes[0]);
  return (
    <g>
      <circle cx="300" cy="300" r="232" fill="#0a0a0a" />
      {shapes.map((s) => (
        <path key={s.i} d={s.d} fill={s.kind === 'pent' ? look.secondary : s.i % 7 === 3 ? look.accent : look.primary} opacity={0.55 + s.depth * 0.45} />
      ))}
      {look.logo ? <image href={look.logo} x={front.cx - 45} y={front.cy - 45} width="90" height="90" preserveAspectRatio="xMidYMid meet" /> : null}
      <circle cx="300" cy="300" r="232" fill="none" stroke="#000" strokeWidth="4" opacity=".6" />
    </g>
  );
}

function Glove({ look }: { look: BallLook }) {
  return (
    <g strokeLinejoin="round">
      <path d="M190 330c-30-40-60-95-40-120 18-22 50-5 70 30l15 25V150c0-28 40-30 42 0v120h8V115c0-30 44-30 44 0v155h8V130c0-28 42-28 42 0v150h8V170c0-26 40-26 40 0v170c0 70-30 120-90 140H260c-40-10-60-60-70-150Z" fill={look.primary} stroke="#000" strokeWidth="3" />
      <path d="M262 470h120c22 0 30 10 30 25v40H230v-40c0-15 10-25 32-25Z" fill={look.secondary} stroke="#000" strokeWidth="3" />
      <path d="M232 500h180" stroke={look.accent} strokeWidth="8" />
      <path d="M235 160v100M287 125v140M339 140v135M391 180v110" stroke={look.accent} strokeWidth="6" strokeLinecap="round" opacity=".9" />
      {look.logo ? <image href={look.logo} x={look.logoPlace === 'side' ? 255 : 280} y={look.logoPlace === 'side' ? 480 : 330} width="90" height="60" preserveAspectRatio="xMidYMid meet" /> : null}
    </g>
  );
}

function Jersey({ look }: { look: BallLook }) {
  return (
    <g strokeLinejoin="round">
      <path d="M210 110l-110 60 40 110 50-20v250h220V260l50 20 40-110-110-60c-10 30-40 50-90 50s-80-20-90-50Z" fill={look.primary} stroke="#000" strokeWidth="3" />
      <path d="M100 170l40 110 50-20-30-120ZM500 170l-40 110-50-20 30-120Z" fill={look.secondary} stroke="#000" strokeWidth="3" />
      <path d="M210 110c10 30 40 50 90 50s80-20 90-50" fill="none" stroke={look.accent} strokeWidth="10" />
      <path d="M190 330v180M410 330v180" stroke={look.accent} strokeWidth="8" />
      {look.logo ? <image href={look.logo} x={look.logoPlace === 'side' ? 330 : 255} y="215" width="90" height="70" preserveAspectRatio="xMidYMid meet" /> : null}
    </g>
  );
}
