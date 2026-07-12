import type { Scene, ThemeId } from '../types';

export interface ThemeContext {
  scene: Scene;
  localTime: number;
  progress: number;
  beat: number;
  W: number;
  H: number;
  seed: number;
}

export type ThemeDrawFn = (ctx: CanvasRenderingContext2D, tc: ThemeContext) => void;

interface Particle { x: number; y: number; vx: number; vy: number; s: number }
interface Star { x: number; y: number; s: number; tw: number }
interface Rain { x: number; y: number; sp: number }

const particles: Particle[] = Array.from({ length: 80 }, () => ({
  x: Math.random(), y: Math.random(),
  vx: (Math.random() - 0.5) * 0.002, vy: -Math.random() * 0.003 - 0.001, s: Math.random() * 3 + 1,
}));
const stars: Star[] = Array.from({ length: 120 }, () => ({
  x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5, tw: Math.random() * Math.PI * 2,
}));
const rain: Rain[] = Array.from({ length: 60 }, () => ({
  x: Math.random(), y: Math.random(), sp: Math.random() * 0.02 + 0.01,
}));

function drawCityNight(ctx: CanvasRenderingContext2D, { scene, localTime: t, beat, W, H }: ThemeContext) {
  const [c1, c2, c3] = scene.colors;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c1); g.addColorStop(1, '#0a0818');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const bH = H * 0.35;
  for (let i = 0; i < 12; i++) {
    const bw = W / 12;
    const h = bH * (0.4 + Math.sin(i * 1.3 + t * 0.5) * 0.3 + beat * 0.2);
    ctx.fillStyle = i % 2 === 0 ? c2 : c3;
    ctx.globalAlpha = 0.6 + beat * 0.3;
    ctx.fillRect(i * bw, H - h, bw - 2, h);
    for (let w = 0; w < 4; w++) {
      if (Math.sin(t * 3 + i + w) > 0) {
        ctx.fillStyle = 'rgba(255,220,100,.8)';
        ctx.fillRect(i * bw + 4, H - h + 20 + w * 30, bw - 10, 8);
      }
    }
  }
  ctx.globalAlpha = 1;
  particles.forEach((p) => {
    p.x += p.vx; p.y += p.vy;
    if (p.y < 0) p.y = 1;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, p.s, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,200,100,${0.3 + beat * 0.5})`;
    ctx.fill();
  });
}

function drawSunrise(ctx: CanvasRenderingContext2D, { scene, progress, beat, W, H }: ThemeContext) {
  const [c1, c2, c3] = scene.colors;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c3); g.addColorStop(0.5, c2); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const sunY = H * 0.55 - Math.sin(progress * Math.PI) * H * 0.15;
  const sunG = ctx.createRadialGradient(W / 2, sunY, 0, W / 2, sunY, W * 0.35);
  sunG.addColorStop(0, 'rgba(255,240,200,.9)'); sunG.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = sunG;
  ctx.beginPath(); ctx.arc(W / 2, sunY, W * 0.3 + beat * 20, 0, Math.PI * 2); ctx.fill();

  ctx.save(); ctx.translate(W / 2, H); ctx.scale(1 + progress * 0.1, 1 + progress * 0.1);
  ctx.fillStyle = 'rgba(60,40,30,.5)';
  for (let i = -3; i <= 3; i++) ctx.fillRect(i * W * 0.15, -H * 0.15, W * 0.12, H * 0.15);
  ctx.restore();
}

function drawOcean(ctx: CanvasRenderingContext2D, { scene, localTime: t, beat, W, H }: ThemeContext) {
  const [c1, c2] = scene.colors;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c2); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let w = 0; w < 5; w++) {
    ctx.beginPath(); ctx.moveTo(0, H * 0.5 + w * 30);
    for (let x = 0; x <= W; x += 20) {
      ctx.lineTo(x, H * 0.5 + w * 30 + Math.sin(x * 0.008 + t * 2 + w) * 20 + beat * 15);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${0.05 + w * 0.02})`; ctx.fill();
  }
}

function drawForest(ctx: CanvasRenderingContext2D, { scene, beat, W, H }: ThemeContext) {
  const [c1, c2, c3] = scene.colors;
  ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 15; i++) {
    const tx = i * W / 14;
    const th = H * (0.2 + Math.sin(i * 0.8) * 0.1);
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.moveTo(tx, H); ctx.lineTo(tx - W * 0.04, H - th); ctx.lineTo(tx + W * 0.04, H - th); ctx.fill();
    ctx.fillStyle = c3;
    ctx.beginPath(); ctx.arc(tx, H - th, W * 0.06 + beat * 5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawAbstract(ctx: CanvasRenderingContext2D, { scene, localTime: t, beat, W, H }: ThemeContext) {
  const [c1, c2, c3] = scene.colors;
  ctx.fillStyle = '#0a0812'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  for (let i = 0; i < 6; i++) {
    const a = t * 1.5 + i * Math.PI / 3;
    const r = W * 0.15 + beat * W * 0.1 + Math.sin(t + i) * W * 0.05;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, W * 0.08 + beat * W * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = [c1, c2, c3][i % 3];
    ctx.globalAlpha = 0.5 + beat * 0.4; ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c2; ctx.lineWidth = 2 + beat * 4;
  ctx.beginPath();
  for (let x = 0; x < W; x += 10) {
    ctx.lineTo(x, cy + Math.sin(x * 0.01 + t * 3) * H * 0.15);
  }
  ctx.stroke();
}

function drawRain(ctx: CanvasRenderingContext2D, { scene, beat, W, H }: ThemeContext) {
  const [c1] = scene.colors;
  ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
  rain.forEach((d) => {
    d.y += d.sp; if (d.y > 1) d.y = 0; d.x += 0.001;
    ctx.strokeStyle = 'rgba(180,200,255,.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(d.x * W, d.y * H); ctx.lineTo(d.x * W + 5, d.y * H + 20); ctx.stroke();
  });
  ctx.fillStyle = `rgba(255,255,255,${0.03 + beat * 0.05})`;
  ctx.fillRect(0, 0, W, beat * H * 0.05);
}

function drawStarfield(ctx: CanvasRenderingContext2D, { scene, beat, W, H }: ThemeContext) {
  const [c1, , c3] = scene.colors;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c1); g.addColorStop(1, '#0a0818');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  stars.forEach((s) => {
    s.tw += 0.05;
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.s, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(s.tw) * 0.3 + beat * 0.3})`; ctx.fill();
  });
  const rg = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.2 + beat * 30);
  rg.addColorStop(0, c3 + '88'); rg.addColorStop(1, 'transparent');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
}

function drawTravel(ctx: CanvasRenderingContext2D, { scene, localTime: t, beat, W, H }: ThemeContext) {
  const [c1, c2] = scene.colors;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c2); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const horizon = H * 0.55;
  ctx.fillStyle = 'rgba(40,30,20,.6)'; ctx.fillRect(0, horizon, W, H - horizon);
  const offset = (t * 200) % W;
  for (let i = -1; i < 3; i++) {
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.fillRect(i * W * 0.6 + offset, horizon - 2, W * 0.3, 4);
  }
  ctx.fillStyle = 'rgba(255,200,100,.8)';
  ctx.beginPath(); ctx.arc(W * 0.7, horizon * 0.6, W * 0.04 + beat * 10, 0, Math.PI * 2); ctx.fill();
}

function drawLyricsScene(ctx: CanvasRenderingContext2D, { scene, beat, W, H }: ThemeContext) {
  const [c1, c2, c3] = scene.colors;
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, c2 + 'cc'); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = c3; ctx.lineWidth = 1 + beat * 3; ctx.globalAlpha = 0.3;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.1 + i * W * 0.06 + beat * 10, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export const THEMES: Record<ThemeId, ThemeDrawFn> = {
  cityNight: drawCityNight,
  sunrise: drawSunrise,
  ocean: drawOcean,
  forest: drawForest,
  abstract: drawAbstract,
  rain: drawRain,
  starfield: drawStarfield,
  travel: drawTravel,
  lyrics: drawLyricsScene,
};

export function getBeatPhase(t: number, beats: Scene['beats']): number {
  if (beats.length === 0) return 0;
  let closest = beats[0];
  let minD = Math.abs(t - closest.time);
  for (const b of beats) {
    const d = Math.abs(t - b.time);
    if (d < minD) { minD = d; closest = b; }
  }
  return Math.max(0, 1 - minD * 0.5) * (closest.strength || 1);
}

export function findSceneAt(scenes: Scene[], t: number): { scene: Scene; index: number } {
  for (let i = 0; i < scenes.length; i++) {
    if (t >= scenes[i].startTime && t < scenes[i].endTime) return { scene: scenes[i], index: i };
  }
  return { scene: scenes[scenes.length - 1], index: scenes.length - 1 };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const chars = text.split('');
  let line = '';
  const lines: string[] = [];
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = ch; }
    else line = test;
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineH));
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  scenes: Scene[],
  t: number,
  W: number,
  H: number,
) {
  const { scene } = findSceneAt(scenes, t);
  const localT = t - scene.startTime;
  const progress = localT / scene.duration;
  const beat = getBeatPhase(t, scene.beats);
  const draw = THEMES[scene.theme] ?? THEMES.abstract;

  ctx.save();
  draw(ctx, { scene, localTime: localT, progress, beat, W, H, seed: scene.id.length });
  ctx.restore();

  const caption = scene.lyricLine || scene.caption;
  if (caption) {
    const alpha = progress < 0.1 ? progress * 10 : progress > 0.85 ? (1 - progress) * 6.67 : 1;
    ctx.save(); ctx.globalAlpha = Math.min(1, alpha);
    ctx.font = `bold ${Math.floor(W * 0.055)}px "PingFang SC",sans-serif`;
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12;
    wrapText(ctx, caption, W / 2, H * 0.78 + Math.sin(progress * Math.PI * 2) * beat * 8, W * 0.85, Math.floor(W * 0.07));
    ctx.restore();
  }

  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(W * 0.1, H * 0.96, W * 0.8, 4);
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(W * 0.1, H * 0.96, W * 0.8 * (t / scenes[scenes.length - 1].endTime), 4);
}
