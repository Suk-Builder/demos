import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API = '/api';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function fmtCount(n: number) {
  return n >= 10000 ? `${(n/10000).toFixed(1)}万` : n >= 1000 ? `${(n/1000).toFixed(1)}千` : `${n}`;
}

interface HomePageProps {
  sort?: string;
  title?: string;
  subtitle?: string;
}

export default function HomePage({ sort, title, subtitle }: HomePageProps) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ page: '1', limit: '20' });
    if (sort) params.append('sort', sort);
    fetch(`${API}/videos?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const vids = data.data?.videos || data.videos || [];
        setVideos(vids);
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <div>
      <div className="mb-6 p-6 rounded-xl border border-[#CD5700]/20 bg-gradient-to-r from-[#121214] to-[#0a0a0f]">
        <h1 className="text-3xl font-bold"><span className="text-[#CD5700]">Suka</span><span className="text-[#e8e6e3]">čev</span></h1>
        <p className="text-[#8a8680] mt-2 text-sm">{subtitle || "裂缝·递砖·建造者 — 裂缝中的视频平台"}</p>
      </div>

      {loading ? (
        <div className="flex justify-center h-64"><div className="w-8 h-8 border-2 border-[#CD5700] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {videos.map((v: any) => (
            <Link to={`/video/${v.id}`} key={v.id} className="group block">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-[#121214] border border-[#1a1a1e] group-hover:border-[#CD5700]/30 transition-all">
                <img src={v.thumbnail_url || `https://picsum.photos/400/225?random=${v.id}`} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-[#0a0a0f]/90 text-[#e8e6e3] text-xs font-mono rounded">{formatDuration(v.duration || 0)}</div>
              </div>
              <div className="mt-3">
                <h3 className="text-sm font-medium text-[#e8e6e3] line-clamp-2 group-hover:text-[#CD5700] transition-colors">{v.title}</h3>
                <p className="mt-1 text-xs text-[#5a5a5e]">{fmtCount(v.views_count || 0)}播放 · {fmtCount(v.danmaku_count || 0)}弹幕</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
