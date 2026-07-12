import type { Scene, Storyboard } from '../types';

export interface SmartInputCallbacks {
  onSceneChange: (index: number) => void;
  onPlayPause: () => void;
  onRender: () => void;
  onExport: () => void;
  onNewSong: () => void;
  onAnalyze: () => void;
  getSceneCount: () => number;
  getCurrentScene: () => number;
  isStoryboardVisible: () => boolean;
  isAnalyzeReady: () => boolean;
}

export function initSmartDevices(cb: SmartInputCallbacks): void {
  setupRing(cb);
  setupCane(cb);
  if (isGlassesMode()) setupVoice(cb);
}

function setupRing(cb: SmartInputCallbacks): void {
  if (typeof DeviceOrientationEvent === 'undefined') return;
  const el = document.getElementById('ring-status');
  if (!el) return;
  el.style.display = 'flex';

  let active = false;
  let frame = 0;
  let prevBeta: number | null = null;
  let prevGamma = 0;

  const enable = () => {
    active = true;
    el.classList.add('active');
    el.textContent = '💍 已连接';
    window.addEventListener('deviceorientation', (e) => {
      if (!active) return;
      frame++;
      if (frame % 8 !== 0) return;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      if (prevBeta === null) { prevBeta = beta; return; }
      const dG = gamma - prevGamma;
      prevGamma = gamma;
      if (Math.abs(dG) > 5 && cb.getSceneCount() > 0) {
        const next = Math.max(0, Math.min(cb.getSceneCount() - 1, cb.getCurrentScene() + (dG > 0 ? 1 : -1)));
        cb.onSceneChange(next);
      }
      if (Math.abs(beta - prevBeta) > 8) cb.onPlayPause();
      prevBeta = beta;
    });
  };

  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (typeof DOE.requestPermission === 'function') {
    el.textContent = '💍 点击启用';
    el.onclick = async () => {
      try {
        const p = await DOE.requestPermission!();
        if (p === 'granted') { enable(); el.onclick = null; }
      } catch { /* */ }
    };
  } else enable();
}

function setupCane(cb: SmartInputCallbacks): void {
  if (typeof DeviceMotionEvent === 'undefined') return;
  const el = document.getElementById('cane-status');
  if (!el) return;
  el.style.display = 'flex';

  let active = false;
  let frame = 0;
  let last = { x: 0, y: 0, z: 0 };

  const enable = () => {
    active = true;
    el.classList.add('active');
    el.textContent = '🦯 已连接';
    window.addEventListener('devicemotion', (e) => {
      if (!active) return;
      frame++;
      if (frame % 6 !== 0) return;
      const a = e.accelerationIncludingGravity ?? e.acceleration ?? { x: 0, y: 0, z: 0 };
      const dx = Math.abs((a.x ?? 0) - last.x);
      const dy = Math.abs((a.y ?? 0) - last.y);
      const dz = Math.abs((a.z ?? 0) - last.z);
      last = { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 };
      if (dx > 8 || dy > 8 || dz > 8) {
        if (cb.isStoryboardVisible()) cb.onRender();
        else cb.onPlayPause();
      }
    });
  };

  const DME = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (typeof DME.requestPermission === 'function') {
    el.textContent = '🦯 点击启用';
    el.onclick = async () => {
      try {
        const p = await DME.requestPermission!();
        if (p === 'granted') { enable(); el.onclick = null; }
      } catch { /* */ }
    };
  } else enable();
}

function isGlassesMode(): boolean {
  const w = innerWidth, h = innerHeight;
  return (w <= 420 && h <= 340) || (w <= 340 && h <= 420);
}

function setupVoice(cb: SmartInputCallbacks): void {
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!SR) return;
  const el = document.getElementById('voice-status');
  const dot = document.getElementById('voice-dot');
  if (!el) return;
  el.style.display = 'flex';

  const rec = new SR();
  rec.lang = 'zh-CN';
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript.trim().toLowerCase();
      if (/生成|渲染|开始/.test(t)) {
        if (cb.isStoryboardVisible()) cb.onRender();
        else if (cb.isAnalyzeReady()) cb.onAnalyze();
      }
      if (/导出|下载/.test(t)) cb.onExport();
      if (/暂停|停/.test(t)) cb.onPlayPause();
      if (/播放|重播/.test(t)) cb.onPlayPause();
      if (/新歌|换/.test(t)) cb.onNewSong();
    }
  };
  rec.onend = () => { try { rec.start(); } catch { /* */ } };
  try { rec.start(); dot?.classList.add('active'); } catch { /* */ }
}

export function drawSceneThumb(canvas: HTMLCanvasElement, scene: Scene): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const [c1, c2, c3] = scene.colors;
  const g = ctx.createLinearGradient(0, 0, 0, 96);
  g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c3);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 72, 96);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(scene.caption.slice(0, 6), 36, 50);
}
