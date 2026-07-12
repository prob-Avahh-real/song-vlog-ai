import type { AiConfig, Scene, SongAnalysis } from '../types';

export function buildStoryboardPrompt(analysis: SongAnalysis, sceneCount: number): string {
  const { bpm, mood, flow, vibe, duration } = analysis;
  return `你是一位音乐 MV 导演。根据以下歌曲分析，生成 ${sceneCount} 条中文 vlog 字幕（每条 6-14 字），体现歌词感、画面感和情绪。

歌曲分析：
- BPM: ${bpm}
- 时长: ${Math.floor(duration)}秒
- 主情绪: ${mood.name}（${mood.tags.join('、')}）
- Flow: ${flow}
- Vibe: ${vibe}

要求：
1. 字幕像 vlog 旁白或歌词金句，不要解释音乐
2. 随情绪起伏有变化
3. 只返回 JSON 字符串数组，无其他内容

示例：["夜色落在肩头","这一刻值得铭记","让节奏带走烦恼"]`;
}

export async function enhanceScenesWithAi(
  scenes: Scene[],
  analysis: SongAnalysis,
  config: AiConfig,
  hasLyrics: boolean,
): Promise<void> {
  if (!config.apiKey || hasLyrics) return;

  const prompt = buildStoryboardPrompt(analysis, scenes.length);
  const base = config.baseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
    }),
  });

  if (!res.ok) throw new Error(`AI API ${res.status}`);

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return;

  const captions: string[] = JSON.parse(match[0]);
  captions.forEach((c, i) => {
    if (scenes[i] && typeof c === 'string') {
      scenes[i].caption = c.replace(/^["']|["']$/g, '');
    }
  });
}
