import { Play, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { VideoItem } from '../types/video';

interface VideoCardProps {
  video: VideoItem;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCount(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}千`;
  }
  return String(n);
}

export default function VideoCard({ video }: VideoCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="group cursor-pointer"
      onClick={() => navigate(`/video/${video.id}`)}
    >
      {/* Thumbnail */}
      <div className="relative w-full overflow-hidden rounded-[6px] bg-gray-100" style={{ aspectRatio: '16/9' }}>
        <img
          src={video.thumbnail_url}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {/* Duration badge */}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1 py-0.5 text-[11px] font-medium text-white">
          {formatDuration(video.duration)}
        </span>
      </div>

      {/* Info */}
      <div className="mt-2 flex gap-2.5">
        {/* Avatar - placeholder for now */}
        <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-[#CD5700]/20 flex items-center justify-center text-[10px] text-[#CD5700] font-bold">
          S
        </div>
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3 className="text-[14px] leading-[1.4] font-medium text-[#e8e6e3] line-clamp-2 group-hover:text-[#CD5700] transition-colors">
            {video.title}
          </h3>
          {/* Author - placeholder */}
          <p className="mt-1 text-[12px] text-[#9499a0] truncate">
            SUK_白桦
          </p>
          {/* Stats */}
          <div className="mt-0.5 flex items-center gap-3 text-[12px] text-[#9499a0]">
            <span className="flex items-center gap-0.5">
              <Play className="h-3 w-3" />
              {formatCount(video.views_count)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {formatCount(video.danmaku_count)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

