import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ExportResult, RenderProgress, Storyboard } from '../types';
import { VIDEO_FPS, VIDEO_H, VIDEO_W } from '../types';
import { renderFrame } from '../render/renderer';

const CORE_VERSION = '0.12.10';
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

const LOAD_TIMEOUT_MS = 30_000;

let ffmpegInstance: FFmpeg | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Encode phase timeout — short songs fall back to realtime recorder quickly. */
export function getFfmpegEncodeTimeout(durationSec: number): number {
  if (durationSec <= 15) return 12_000;
  if (durationSec <= 60) return 30_000;
  return 90_000;
}

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  await withTimeout(
    ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    }),
    LOAD_TIMEOUT_MS,
    'ffmpeg-load',
  );
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

async function cleanupFrames(ffmpeg: FFmpeg, totalFrames: number): Promise<void> {
  for (let f = 0; f < totalFrames; f++) {
    try { await ffmpeg.deleteFile(`frame_${String(f).padStart(6, '0')}.jpg`); } catch { /* */ }
  }
  try {
    await ffmpeg.deleteFile('audio.wav');
    await ffmpeg.deleteFile('output.mp4');
  } catch { /* */ }
}

export async function exportWithFfmpeg(
  storyboard: Storyboard,
  audioWav: Blob,
  onProgress: (p: RenderProgress) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const { scenes, analysis } = storyboard;
  const duration = analysis.duration;
  const totalFrames = Math.ceil(duration * VIDEO_FPS);
  const encodeTimeout = getFfmpegEncodeTimeout(duration);

  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const ctx = canvas.getContext('2d')!;

  onProgress({ phase: 'prepare', percent: 0, message: '加载 FFmpeg…' });
  const ffmpeg = await getFfmpeg();

  onProgress({ phase: 'frames', percent: 2, message: '离线渲染帧…' });
  const batchSize = 30;

  try {
    for (let start = 0; start < totalFrames; start += batchSize) {
      if (signal?.aborted) throw new Error('aborted');
      const end = Math.min(start + batchSize, totalFrames);

      for (let f = start; f < end; f++) {
        const t = f / VIDEO_FPS;
        renderFrame(ctx, scenes, t, VIDEO_W, VIDEO_H);
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92),
        );
        const buf = new Uint8Array(await blob.arrayBuffer());
        await ffmpeg.writeFile(`frame_${String(f).padStart(6, '0')}.jpg`, buf);
      }

      const pct = 2 + (end / totalFrames) * 68;
      onProgress({ phase: 'frames', percent: pct, message: `渲染帧 ${end}/${totalFrames}` });
    }

    onProgress({ phase: 'encode', percent: 72, message: '写入音频…' });
    await ffmpeg.writeFile('audio.wav', await fetchFile(audioWav));

    onProgress({
      phase: 'encode',
      percent: 78,
      message: `合成 MP4…（超时 ${Math.round(encodeTimeout / 1000)}s 后自动切换录制）`,
    });

    await withTimeout(
      ffmpeg.exec([
        '-framerate', String(VIDEO_FPS),
        '-i', 'frame_%06d.jpg',
        '-i', 'audio.wav',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest',
        '-movflags', '+faststart',
        'output.mp4',
      ]),
      encodeTimeout,
      'ffmpeg-exec',
    );

    onProgress({ phase: 'encode', percent: 95, message: '读取输出…' });
    const data = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([data as BlobPart], { type: 'video/mp4' });
    await cleanupFrames(ffmpeg, totalFrames);

    onProgress({ phase: 'done', percent: 100, message: '完成' });
    return { blob, mimeType: 'video/mp4', size: blob.size, method: 'ffmpeg' };
  } catch (e) {
    await cleanupFrames(ffmpeg, totalFrames);
    throw e;
  }
}

export async function exportWithMediaRecorder(
  storyboard: Storyboard,
  audioBuffer: AudioBuffer,
  onProgress: (p: RenderProgress) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const { scenes, analysis } = storyboard;
  const duration = analysis.duration;

  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const ctx = canvas.getContext('2d')!;

  onProgress({ phase: 'prepare', percent: 5, message: '实时录制模式…' });

  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(dest);

  const stream = canvas.captureStream(VIDEO_FPS);
  const combined = new MediaStream([
    ...stream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus' : 'video/webm';

  const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 8e6 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start(200);
  source.start(0);

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (signal?.aborted) { source.stop(); recorder.stop(); resolve(); return; }
      const elapsed = (performance.now() - start) / 1000;
      const pct = Math.min(95, (elapsed / duration) * 100);
      onProgress({ phase: 'encode', percent: pct, message: `录制 ${Math.floor(pct)}%` });
      renderFrame(ctx, scenes, elapsed, VIDEO_W, VIDEO_H);
      if (elapsed < duration) requestAnimationFrame(tick);
      else setTimeout(() => { source.stop(); recorder.stop(); resolve(); }, 300);
    };
    requestAnimationFrame(tick);
  });

  await audioCtx.close();
  const blob = await done;
  onProgress({ phase: 'done', percent: 100, message: '完成' });
  return { blob, mimeType, size: blob.size, method: 'mediarecorder' };
}

export function isMobileCapacitor(): boolean {
  return !!(window as unknown as { Capacitor?: unknown }).Capacitor;
}

export async function exportVideo(
  storyboard: Storyboard,
  audioBuffer: AudioBuffer,
  audioWav: Blob,
  onProgress: (p: RenderProgress) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  if (!isMobileCapacitor()) {
    try {
      return await exportWithFfmpeg(storyboard, audioWav, onProgress, signal);
    } catch (e) {
      const reason = (e as Error).message ?? '';
      const isTimeout = reason.includes('timeout:');
      console.warn('FFmpeg failed, falling back to MediaRecorder', e);
      onProgress({
        phase: 'encode',
        percent: 78,
        message: isTimeout
          ? 'FFmpeg 合成超时，切换实时录制…'
          : 'FFmpeg 不可用，切换实时录制…',
      });
    }
  }
  return exportWithMediaRecorder(storyboard, audioBuffer, onProgress, signal);
}
