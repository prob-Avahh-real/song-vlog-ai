export type MoodId =
  | 'energetic' | 'chill' | 'melancholic' | 'intense'
  | 'dreamy' | 'romantic' | 'urban' | 'peaceful';

export type ThemeId =
  | 'cityNight' | 'sunrise' | 'ocean' | 'forest' | 'abstract'
  | 'rain' | 'starfield' | 'travel' | 'lyrics';

export type VlogStyle =
  | 'auto' | 'cinematic' | 'travel' | 'nightlife'
  | 'nature' | 'lyric' | 'abstract' | 'retro';

export type FlowType = 'steady' | 'groovy' | 'dynamic' | 'syncopated';
export type VibeType = 'glow' | 'haze' | 'fire' | 'mist' | 'pulse';

export interface Beat {
  time: number;
  energy: number;
  strength: number;
}

export interface Section {
  startTime: number;
  endTime: number;
  startFrame: number;
  endFrame: number;
  avgEnergy: number;
  novelty: number;
}

export interface AudioFeatures {
  energies: Float32Array;
  spectralFlux: Float32Array;
  spectralCentroid: Float32Array;
  bassEnergy: Float32Array;
  hopRate: number;
  frameCount: number;
}

export interface MoodProfile {
  key: MoodId;
  name: string;
  colors: [string, string, string];
  theme: ThemeId;
  tags: string[];
  confidence: number;
}

export interface SongAnalysis {
  duration: number;
  sampleRate: number;
  channelData: Float32Array;
  bpm: number;
  beats: Beat[];
  sections: Section[];
  features: AudioFeatures;
  mood: MoodProfile;
  flow: FlowType;
  vibe: VibeType;
  avgEnergy: number;
  maxEnergy: number;
  engine: 'essentia' | 'local';
  key?: string;
  scale?: string;
  danceability?: number;
  rhythmConfidence?: number;
}

export interface Scene {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  theme: ThemeId;
  mood: MoodId;
  caption: string;
  lyricLine: string;
  beats: Beat[];
  colors: [string, string, string];
  transition: 'cut' | 'fade' | 'beat';
}

export interface Storyboard {
  songTitle: string;
  style: VlogStyle;
  analysis: SongAnalysis;
  scenes: Scene[];
}

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
}

export interface RenderProgress {
  phase: 'prepare' | 'frames' | 'encode' | 'done';
  percent: number;
  message: string;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  size: number;
  method: 'ffmpeg' | 'mediarecorder';
}

export const MOODS: Record<MoodId, Omit<MoodProfile, 'confidence'>> = {
  energetic: { key: 'energetic', name: '热血', colors: ['#ff4060', '#ff8040', '#ffc040'], theme: 'cityNight', tags: [] },
  chill: { key: 'chill', name: '慵懒', colors: ['#4080c0', '#60a0d0', '#80c0e0'], theme: 'ocean', tags: [] },
  melancholic: { key: 'melancholic', name: '忧郁', colors: ['#304060', '#405080', '#5060a0'], theme: 'rain', tags: [] },
  intense: { key: 'intense', name: '激烈', colors: ['#c02040', '#e04060', '#ff2060'], theme: 'abstract', tags: [] },
  dreamy: { key: 'dreamy', name: '梦幻', colors: ['#8040c0', '#a060e0', '#c080ff'], theme: 'starfield', tags: [] },
  romantic: { key: 'romantic', name: '浪漫', colors: ['#e060a0', '#f080b0', '#ffa0c0'], theme: 'sunrise', tags: [] },
  urban: { key: 'urban', name: '都市', colors: ['#202040', '#404060', '#6060a0'], theme: 'cityNight', tags: [] },
  peaceful: { key: 'peaceful', name: '宁静', colors: ['#306040', '#408060', '#60a080'], theme: 'forest', tags: [] },
};

export const VLOG_STYLES: { id: VlogStyle; emoji: string; name: string }[] = [
  { id: 'auto', emoji: '✨', name: '自动' },
  { id: 'cinematic', emoji: '🎥', name: '电影感' },
  { id: 'travel', emoji: '✈️', name: '旅行' },
  { id: 'nightlife', emoji: '🌃', name: '夜生活' },
  { id: 'nature', emoji: '🌿', name: '自然' },
  { id: 'lyric', emoji: '📝', name: '歌词向' },
  { id: 'abstract', emoji: '🔮', name: '抽象' },
  { id: 'retro', emoji: '📼', name: '复古' },
];

export const VIDEO_W = 1080;
export const VIDEO_H = 1920;
export const VIDEO_FPS = 30;
