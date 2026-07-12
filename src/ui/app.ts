import '../styles.css';
import { decodeAudioFile, audioBufferToWav, formatDuration } from '../audio/decode';
import { runAudioAnalysis } from '../audio/runner';
import { enhanceScenesWithAi } from '../ai/storyboard';
import { buildScenes, parseLyrics } from '../story/planner';
import { exportVideo } from '../export/encoder';
import { drawSceneThumb, initSmartDevices } from '../devices/smart-input';
import type { AiConfig, Storyboard, VlogStyle, RenderProgress } from '../types';
import { VLOG_STYLES } from '../types';

type Screen = 'input' | 'analyze' | 'storyboard' | 'render' | 'preview';

export class App {
  private screen: Screen = 'input';
  private audioBuffer: AudioBuffer | null = null;
  private fileName = '';
  private style: VlogStyle = 'auto';
  private lyricsText = '';
  private aiConfig: AiConfig = { apiKey: '', baseUrl: 'https://api.openai.com/v1' };
  private storyboard: Storyboard | null = null;
  private videoUrl: string | null = null;
  private videoBlob: Blob | null = null;
  private currentSceneIdx = 0;
  private abort: AbortController | null = null;

  private el = {
    app: document.getElementById('app')!,
    bg: document.getElementById('bg-canvas') as HTMLCanvasElement,
  };

  mount(): void {
    this.render();
    this.drawBg();
    initSmartDevices({
      onSceneChange: (i) => this.selectScene(i),
      onPlayPause: () => this.togglePreview(),
      onRender: () => { if (this.screen === 'storyboard') this.startRender(); },
      onExport: () => this.download(),
      onNewSong: () => this.reset(),
      onAnalyze: () => { if (this.audioBuffer) this.analyze(); },
      getSceneCount: () => this.storyboard?.scenes.length ?? 0,
      getCurrentScene: () => this.currentSceneIdx,
      isStoryboardVisible: () => this.screen === 'storyboard',
      isAnalyzeReady: () => !!this.audioBuffer,
    });
  }

  private show(s: Screen): void {
    this.screen = s;
    this.render();
  }

  private render(): void {
    const s = this.screen;
    this.el.app.innerHTML = `
      <div id="device-bar">
        <span class="dev-badge clickable" id="ring-status">💍 戒指</span>
        <span class="dev-badge clickable" id="cane-status">🦯 手杖</span>
        <span class="dev-badge" id="voice-status">👓 语音<span id="voice-dot"></span></span>
      </div>
      ${s === 'input' ? this.renderInput() : ''}
      ${s === 'analyze' ? this.renderAnalyze() : ''}
      ${s === 'storyboard' ? this.renderStoryboard() : ''}
      ${s === 'render' ? this.renderRender() : ''}
      ${s === 'preview' ? this.renderPreview() : ''}
    `;
    this.bindEvents();
  }

  private renderInput(): string {
    const styles = VLOG_STYLES.map((st) =>
      `<div class="style-btn${st.id === this.style ? ' active' : ''}" data-style="${st.id}">
        <span class="emoji">${st.emoji}</span>${st.name}
      </div>`,
    ).join('');
    return `
      <div class="screen active">
        <h1>🎬 曲影 AI</h1>
        <p class="subtitle">喂一首歌，根据 rhythm · vibe · flow · tempo 自动生成 vlog</p>
        <div class="card">
          <div class="upload-zone" id="upload-zone">
            <div class="icon">🎵</div>
            <div id="upload-text">${this.fileName ? '✅ ' + this.fileName : '点击或拖入音频文件'}</div>
            <div class="hint">MP3 · WAV · M4A · OGG · 长度不限</div>
            <input type="file" id="file-input" accept="audio/*" hidden>
          </div>
        </div>
        <div class="card">
          <label>歌词（可选，按段落对齐分镜）</label>
          <textarea id="lyrics-input" placeholder="粘贴歌词或 LRC，每行一句…">${this.lyricsText}</textarea>
        </div>
        <div class="card">
          <label>Vlog 风格</label>
          <div class="style-grid">${styles}</div>
        </div>
        <div class="card">
          <label>AI 分镜增强（OpenAI 兼容 API，可选）</label>
          <div class="api-row">
            <input type="password" id="api-key" placeholder="sk-… 留空则用本地分镜引擎" value="${this.aiConfig.apiKey}">
            <input type="text" id="api-base" value="${this.aiConfig.baseUrl}" placeholder="API Base">
          </div>
        </div>
        <button class="btn-primary" id="btn-analyze" ${this.audioBuffer ? '' : 'disabled'}>
          🔍 分析并生成分镜
        </button>
      </div>`;
  }

  private renderAnalyze(): string {
    const a = this.storyboard?.analysis;
    if (!a) return `<div class="screen active"><h1>🔍 分析中</h1><div class="progress-bar"><div class="progress-fill" id="prog" style="width:10%"></div></div></div>`;
    return `
      <div class="screen active">
        <h1>🔍 分析完成</h1>
        <p class="subtitle">${this.fileName} · ${a.engine === 'essentia' ? '⚡ Essentia' : '本地引擎'}</p>
        <div class="card">
          <div class="stat-grid">
            <div class="stat"><div class="val">${a.bpm}</div><div class="lbl">BPM</div></div>
            <div class="stat"><div class="val">${formatDuration(a.duration)}</div><div class="lbl">时长</div></div>
            <div class="stat"><div class="val">${a.key ? `${a.key}${a.scale === 'minor' ? 'm' : ''}` : '—'}</div><div class="lbl">调性</div></div>
            <div class="stat"><div class="val">${a.flow}</div><div class="lbl">Flow</div></div>
            <div class="stat"><div class="val">${a.vibe}</div><div class="lbl">Vibe</div></div>
            <div class="stat"><div class="val">${a.danceability != null ? a.danceability.toFixed(1) : '—'}</div><div class="lbl">律动</div></div>
            <div class="stat"><div class="val">${a.mood.name}</div><div class="lbl">情绪</div></div>
            <div class="stat"><div class="val">${a.engine === 'essentia' ? 'Essentia' : 'Local'}</div><div class="lbl">引擎</div></div>
          </div>
          <canvas class="energy-chart" id="energy-chart"></canvas>
          <div>${a.mood.tags.map((t) => `<span class="mood-tag">${t}</span>`).join('')}</div>
        </div>
      </div>`;
  }

  private renderStoryboard(): string {
    const sb = this.storyboard;
    if (!sb) return '';
    const thumbs = sb.scenes.map((sc, i) =>
      `<div class="scene-thumb${i === this.currentSceneIdx ? ' active' : ''}" data-idx="${i}">
        <canvas width="72" height="96" data-thumb="${i}"></canvas>
        <span class="dur">${sc.duration.toFixed(1)}s</span>
        <span class="cap">${sc.caption}</span>
      </div>`,
    ).join('');
    return `
      <div class="screen active">
        <h1>📋 分镜</h1>
        <p class="subtitle">${sb.songTitle} · ${sb.analysis.bpm} BPM${sb.analysis.key ? ` · ${sb.analysis.key}${sb.analysis.scale === 'minor' ? 'm' : ''}` : ''} · ${sb.scenes.length} 场景 · ${formatDuration(sb.analysis.duration)} · ${sb.analysis.engine === 'essentia' ? 'Essentia' : 'Local'}</p>
        <div class="card"><div class="timeline">${thumbs}</div></div>
        <button class="btn-primary" id="btn-render">🎬 渲染视频（离线加速）</button>
        <button class="btn-secondary" id="btn-back">← 换一首歌</button>
      </div>`;
  }

  private renderRender(): string {
    return `
      <div class="screen active">
        <h1>🎬 渲染中</h1>
        <p class="subtitle" id="render-msg">准备…</p>
        <div class="progress-bar"><div class="progress-fill" id="render-prog"></div></div>
        <p class="hint" id="render-phase"></p>
      </div>`;
  }

  private renderPreview(): string {
    return `
      <div class="screen active">
        <h1>✨ 完成</h1>
        <p class="subtitle" id="preview-info"></p>
        <video id="preview-video" controls playsinline></video>
        <button class="btn-primary" id="btn-download">⬇️ 下载视频</button>
        <button class="btn-secondary" id="btn-new">🎵 新歌</button>
      </div>`;
  }

  private bindEvents(): void {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    zone?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', () => { if (input.files?.[0]) this.loadFile(input.files[0]); });
    zone?.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
    zone?.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone?.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('drag');
      const f = (e as DragEvent).dataTransfer?.files[0];
      if (f) this.loadFile(f);
    });

    document.querySelectorAll('[data-style]').forEach((el) => {
      el.addEventListener('click', () => {
        this.style = (el as HTMLElement).dataset.style as VlogStyle;
        this.render();
      });
    });

    document.getElementById('btn-analyze')?.addEventListener('click', () => this.analyze());
    document.getElementById('btn-render')?.addEventListener('click', () => this.startRender());
    document.getElementById('btn-back')?.addEventListener('click', () => this.show('input'));
    document.getElementById('btn-download')?.addEventListener('click', () => this.download());
    document.getElementById('btn-new')?.addEventListener('click', () => this.reset());

    this.storyboard?.scenes.forEach((sc, i) => {
      const c = document.querySelector(`[data-thumb="${i}"]`) as HTMLCanvasElement | null;
      if (c) drawSceneThumb(c, sc);
    });

    document.querySelectorAll('.scene-thumb').forEach((el) => {
      el.addEventListener('click', () => {
        this.selectScene(Number((el as HTMLElement).dataset.idx));
        document.querySelectorAll('.scene-thumb').forEach((x) => x.classList.remove('active'));
        el.classList.add('active');
      });
    });

    if (this.screen === 'preview' && this.videoUrl) {
      const v = document.getElementById('preview-video') as HTMLVideoElement;
      v.src = this.videoUrl;
      const info = document.getElementById('preview-info');
      if (info && this.videoBlob) {
        info.textContent = `${this.fileName} · ${(this.videoBlob.size / 1024 / 1024).toFixed(1)} MB`;
      }
    }

    if (this.screen === 'storyboard' && this.storyboard) {
      this.drawEnergyChart();
    }
  }

  private async loadFile(file: File): Promise<void> {
    if (!file.type.startsWith('audio/')) return;
    this.fileName = file.name.replace(/\.[^.]+$/, '');
    const { buffer } = await decodeAudioFile(file);
    this.audioBuffer = buffer;
    this.render();
  }

  private getAiConfig(): AiConfig {
    const key = (document.getElementById('api-key') as HTMLInputElement)?.value.trim() ?? '';
    const base = (document.getElementById('api-base') as HTMLInputElement)?.value.trim() ?? 'https://api.openai.com/v1';
    return { apiKey: key, baseUrl: base };
  }

  private async analyze(): Promise<void> {
    if (!this.audioBuffer) return;
    this.lyricsText = (document.getElementById('lyrics-input') as HTMLTextAreaElement)?.value ?? this.lyricsText;
    this.aiConfig = this.getAiConfig();
    this.show('analyze');
    this.updateProgress('analyze', 10, '启动 Essentia 音频引擎…');

    const ch = this.audioBuffer.getChannelData(0);
    const mono = new Float32Array(ch.length);
    if (this.audioBuffer.numberOfChannels > 1) {
      const ch1 = this.audioBuffer.getChannelData(1);
      for (let i = 0; i < ch.length; i++) mono[i] = (ch[i] + ch1[i]) * 0.5;
    } else mono.set(ch);

    const analysis = await runAudioAnalysis(
      mono,
      this.audioBuffer.sampleRate,
      this.audioBuffer.duration,
      (msg) => this.updateProgress('analyze', 50, msg),
    );

    const lyrics = parseLyrics(this.lyricsText);
    const scenes = buildScenes(analysis, lyrics, this.style);

    this.updateProgress('analyze', 85, 'AI 分镜增强…');
    try {
      await enhanceScenesWithAi(scenes, analysis, this.aiConfig, lyrics.length > 0);
    } catch (e) {
      console.warn('AI enhance skipped', e);
    }

    this.storyboard = { songTitle: this.fileName, style: this.style, analysis, scenes };
    this.currentSceneIdx = 0;
    this.render();
    this.show('storyboard');
  }

  private async startRender(): Promise<void> {
    if (!this.storyboard || !this.audioBuffer) return;
    this.show('render');
    this.abort = new AbortController();

    const wav = audioBufferToWav(this.audioBuffer);
    const onProgress = (p: RenderProgress) => {
      const el = document.getElementById('render-prog');
      const msg = document.getElementById('render-msg');
      const phase = document.getElementById('render-phase');
      if (el) el.style.width = `${p.percent}%`;
      if (msg) msg.textContent = p.message;
      if (phase) phase.textContent = `阶段: ${p.phase}`;
    };

    try {
      const result = await exportVideo(
        this.storyboard,
        this.audioBuffer,
        wav,
        onProgress,
        this.abort.signal,
      );
      if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
      this.videoBlob = result.blob;
      this.videoUrl = URL.createObjectURL(result.blob);
      this.show('preview');
    } catch (e) {
      if ((e as Error).message !== 'aborted') {
        const msg = document.getElementById('render-msg');
        if (msg) msg.textContent = `渲染失败: ${(e as Error).message}`;
      }
    }
  }

  private download(): void {
    if (!this.videoBlob) return;
    const ext = this.videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(this.videoBlob);
    a.download = `${this.fileName}-vlog.${ext}`;
    a.click();
  }

  private togglePreview(): void {
    const v = document.getElementById('preview-video') as HTMLVideoElement | null;
    if (!v?.src) return;
    v.paused ? v.play() : v.pause();
  }

  private selectScene(i: number): void {
    this.currentSceneIdx = i;
  }

  private reset(): void {
    this.abort?.abort();
    if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
    this.audioBuffer = null;
    this.storyboard = null;
    this.videoBlob = null;
    this.videoUrl = null;
    this.fileName = '';
    this.show('input');
  }

  private updateProgress(_which: string, pct: number, _msg: string): void {
    const el = document.getElementById('prog');
    if (el) el.style.width = `${pct}%`;
  }

  private drawEnergyChart(): void {
    const a = this.storyboard?.analysis;
    const c = document.getElementById('energy-chart') as HTMLCanvasElement | null;
    if (!a || !c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const energies = a.features.energies;
    const w = c.width = c.offsetWidth * 2;
    const h = c.height = 120;
    const max = Math.max(...energies, 0.01);
    const step = w / energies.length;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#6040c0'); grad.addColorStop(1, '#a060ff');
    ctx.fillStyle = grad;
    for (let i = 0; i < energies.length; i++) {
      const bh = (energies[i] / max) * h * 0.9;
      ctx.fillRect(i * step, h - bh, Math.max(1, step), bh);
    }
  }

  private drawBg(): void {
    const ctx = this.el.bg.getContext('2d');
    if (!ctx) return;
    let t = 0;
    const loop = () => {
      t += 0.005;
      const W = this.el.bg.width = innerWidth;
      const H = this.el.bg.height = innerHeight;
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0a0812'); g.addColorStop(1, '#14102a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 30; i++) {
        const x = (Math.sin(t + i) * 0.5 + 0.5) * W;
        const y = (Math.cos(t * 0.7 + i * 1.3) * 0.5 + 0.5) * H;
        ctx.beginPath(); ctx.arc(x, y, 1 + Math.sin(t + i) * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,80,200,.15)'; ctx.fill();
      }
      requestAnimationFrame(loop);
    };
    addEventListener('resize', () => { this.el.bg.width = innerWidth; this.el.bg.height = innerHeight; });
    loop();
  }
}
