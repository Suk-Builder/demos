import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { API_BASE } from '../api/client';

export interface DanmakuItem {
  id: string;
  text: string;
  time: number;
  color: string;
  type: 'scroll' | 'top' | 'bottom';
  user: string;
}

interface DanmakuEngineProps {
  videoId: string;
}

const DANMAKU_COLORS = ['#ffffff', '#CD5700', '#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C', '#FF6B6B'];

function getDanmakuColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return DANMAKU_COLORS[Math.abs(hash) % DANMAKU_COLORS.length];
}

export default function DanmakuEngine({ videoId }: DanmakuEngineProps) {
  const [danmakuList, setDanmakuList] = useState<DanmakuItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const danmakuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const animationRefs = useRef<Map<string, number>>(new Map());

  // 从API获取弹幕
  useEffect(() => {
    if (!videoId) return;
    setLoading(true);
    fetch(`${API_BASE}/danmakus?videoId=${videoId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.danmakus) {
          const apiDanmakus = data.data.danmakus.map((d: any, i: number) => ({
            id: d.id || `dm_${i}`,
            text: d.content || d.text || '',
            time: d.timestamp || d.time || Math.random() * 60,
            color: d.color || getDanmakuColor(d.user_id || String(i)),
            type: d.type || 'scroll',
            user: d.user_id || '匿名',
          }));
          setDanmakuList(apiDanmakus);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [videoId]);

  const sendDanmaku = useCallback(() => {
    if (!inputText.trim()) return;
    const newDm: DanmakuItem = {
      id: `dm_${Date.now()}`,
      text: inputText.trim(),
      time: Date.now(),
      color: '#CD5700',
      type: 'scroll',
      user: 'SUK_白桦',
    };
    setDanmakuList(prev => [...prev, newDm]);
    setInputText('');
  }, [inputText]);

  useEffect(() => {
    if (!isEnabled || !containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.offsetWidth;

    danmakuList.forEach(dm => {
      if (animationRefs.current.has(dm.id)) return;
      const el = danmakuRefs.current.get(dm.id);
      if (!el) return;

      const duration = 8000 + Math.random() * 4000;
      const startX = containerWidth;
      const endX = -el.offsetWidth - 20;

      el.style.left = `${startX}px`;
      el.style.top = `${20 + Math.random() * (container.offsetHeight - 60)}px`;

      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = elapsed / duration;
        if (progress >= 1) {
          el.style.display = 'none';
          return;
        }
        el.style.left = `${startX + (endX - startX) * progress}px`;
        animationRefs.current.set(dm.id, requestAnimationFrame(animate));
      };
      animationRefs.current.set(dm.id, requestAnimationFrame(animate));
    });

    return () => {
      animationRefs.current.forEach(id => cancelAnimationFrame(id));
    };
  }, [danmakuList, isEnabled]);

  if (loading) {
    return <div className="py-2 text-center text-[#8a8580] text-xs">加载弹幕...</div>;
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="relative w-full h-[200px] overflow-hidden bg-black/5 rounded-lg">
        {isEnabled && danmakuList.map(dm => (
          <div
            key={dm.id}
            ref={el => { if (el) danmakuRefs.current.set(dm.id, el); }}
            className="absolute whitespace-nowrap text-sm font-medium pointer-events-none select-none"
            style={{ color: dm.color, textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
          >
            {dm.text}
          </div>
        ))}
        {!isEnabled && (
          <div className="absolute inset-0 flex items-center justify-center text-[#8a8580] text-sm">
            弹幕已关闭
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2 px-2">
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`text-xs px-2 py-1 rounded ${isEnabled ? 'bg-[#CD5700]/20 text-[#CD5700]' : 'bg-[#2a2a2e] text-[#8a8580]'}`}
        >
          {isEnabled ? '弹' : '关'}
        </button>
        <input
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendDanmaku()}
          placeholder="发一条弹幕吧~"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 text-[#e8e6e3]"
        />
        <button onClick={sendDanmaku} className="text-[#CD5700] hover:text-[#b84d00]">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

