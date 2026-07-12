import type { Beat, Scene, Section, SongAnalysis, VlogStyle, MoodId, ThemeId } from '../types';
import { MOODS } from '../types';

export function parseLyrics(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.replace(/^\[\d+:\d+(?:\.\d+)?\]/, '').trim())
    .filter(Boolean);
}

export function alignLyricsToSections(lines: string[], sections: Section[]): Map<number, string> {
  const map = new Map<number, string>();
  if (lines.length === 0) return map;
  sections.forEach((sec, i) => {
    const idx = Math.floor((i / sections.length) * lines.length);
    map.set(i, lines[Math.min(idx, lines.length - 1)]);
  });
  return map;
}

const CAPTIONS: Record<MoodId, string[]> = {
  energetic: ['冲啊！', '燃起来', '节奏在心跳', '这一刻属于我', '全力以赴'],
  chill: ['慢慢来吧', '午后阳光', '放空一下', '就这样挺好', '微风轻拂'],
  melancholic: ['雨后的街道', '有些话没说出口', '深夜独行', '回忆像风', '月色清冷'],
  intense: ['炸裂时刻', '毫无保留', '全场焦点', '冲破界限', '火力全开'],
  dreamy: ['漂浮在云端', '星光落在肩上', '梦境边缘', '柔软的光', '迷离幻境'],
  romantic: ['遇见你的那天', '心动瞬间', '温柔以待', '月色很美', '余生有你'],
  urban: ['城市霓虹', '街角咖啡', '地铁穿梭', '夜色正浓', '灯火阑珊'],
  peaceful: ['林间微风', '溪水潺潺', '远山如黛', '岁月静好', '万物安宁'],
};

function pickTheme(mood: MoodId, style: VlogStyle, energy: number): ThemeId {
  const map: Partial<Record<VlogStyle, ThemeId>> = {
    lyric: 'lyrics',
    travel: 'travel',
    nature: 'forest',
    nightlife: 'cityNight',
    abstract: 'abstract',
    retro: 'sunrise',
    cinematic: energy > 0.05 ? 'cityNight' : 'sunrise',
  };
  return map[style] ?? MOODS[mood].theme;
}

function pickMood(energy: number, base: MoodId, bpm: number, novelty: number): MoodId {
  if (energy > 0.08 || novelty > 0.45) return 'intense';
  if (energy > 0.05) return bpm > 120 ? 'energetic' : 'urban';
  if (energy < 0.025) return novelty < 0.2 ? 'dreamy' : 'melancholic';
  return base;
}

export function buildScenes(
  analysis: SongAnalysis,
  lyrics: string[],
  style: VlogStyle,
): Scene[] {
  const { sections, beats, mood, bpm } = analysis;
  const lyricMap = alignLyricsToSections(lyrics, sections);

  return sections.map((sec, i) => {
    const moodKey = pickMood(sec.avgEnergy, mood.key, bpm, sec.novelty);
    const theme = pickTheme(moodKey, style, sec.avgEnergy);
    const lyricLine = lyricMap.get(i) || '';
    const caption = lyricLine || CAPTIONS[moodKey][i % CAPTIONS[moodKey].length];

    return {
      id: `scene-${i}`,
      startTime: sec.startTime,
      endTime: sec.endTime,
      duration: sec.endTime - sec.startTime,
      theme,
      mood: moodKey,
      caption,
      lyricLine,
      beats: beats.filter((b) => b.time >= sec.startTime && b.time < sec.endTime),
      colors: MOODS[moodKey].colors,
      transition: sec.novelty > 0.4 ? 'beat' : 'fade',
    };
  });
}
