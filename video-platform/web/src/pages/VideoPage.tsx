import { useRef, useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ThumbsUp,
  Coins,
  Star,
  Share2,
  Plus,
  Check,
  Play,
  Eye,
  Clock,
  Tag,
  MoreHorizontal,
} from 'lucide-react';
import VideoPlayer, { VideoPlayerHandle } from '@/components/VideoPlayer';
import DanmakuEngine from '@/components/DanmakuEngine';
import CommentSection from '@/components/CommentSection';
import BilibiliPlayer from '@/components/BilibiliPlayer';

const API_BASE = '/api';


interface VideoAuthor {
  name: string;
  avatar: string;
  followers: number;
}

interface VideoData {
  id: string;
  title: string;
  author: VideoAuthor;
  views: number;
  likes: number;
  coins: number;
  favorites: number;
  shares: number;
  desc: string;
  tags: string[];
  uploadTime: string;
  category: string;
  videoUrl?: string;
  cover?: string;
}

interface RelatedVideo {
  id: string;
  title: string;
  cover: string;
  views: number;
  duration: string;
  author: string;
}

const DEFAULT_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';
const DEFAULT_POSTER = 'https://picsum.photos/1280/720?random=video';

const relatedVideos: RelatedVideo[] = [
  { id: 'v2', title: 'React 19 新特性全面解析', cover: 'https://picsum.photos/320/180?random=1', views: 45200, duration: '15:30', author: '前端课堂' },
  { id: 'v3', title: '用Canvas实现高性能弹幕系统', cover: 'https://picsum.photos/320/180?random=2', views: 23100, duration: '22:15', author: 'SUK_白桦' },
  { id: 'v4', title: 'PostgreSQL性能优化实战', cover: 'https://picsum.photos/320/180?random=3', views: 18900, duration: '18:45', author: 'DBA老哥' },
  { id: 'v5', title: 'TypeScript高级类型体操', cover: 'https://picsum.photos/320/180?random=4', views: 31500, duration: '30:00', author: '类型体操教练' },
  { id: 'v6', title: 'Node.js流媒体处理指南', cover: 'https://picsum.photos/320/180?random=5', views: 12800, duration: '25:20', author: '后端小王子' },
  { id: 'v7', title: '从零设计视频推荐算法', cover: 'https://picsum.photos/320/180?random=6', views: 26700, duration: '28:10', author: '算法工程师' },
  { id: 'v8', title: 'WebSocket实时通信最佳实践', cover: 'https://picsum.photos/320/180?random=7', views: 19400, duration: '20:50', author: '全栈开发者' },
  { id: 'v9', title: 'Tailwind CSS设计系统搭建', cover: 'https://picsum.photos/320/180?random=8', views: 34200, duration: '16:40', author: 'UI设计师' },
];

const formatNum = (n: number): string => {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
};

// ============ Sub-Components ============

function LikeButton({
  icon,
  activeIcon,
  label,
  count,
  activeColor = '#CD5700',
}: {
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  label: string;
  count: number;
  activeColor?: string;
}) {
  const [active, setActive] = useState(false);
  const [cnt, setCnt] = useState(count);

  return (
    <button
      onClick={() => {
        setActive((v) => {
          setCnt((c) => (v ? c - 1 : c + 1));
          return !v;
        });
      }}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full border transition-all text-sm ${
        active
          ? 'border-transparent text-white'
          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#CD5700] hover:text-[#CD5700]'
      }`}
      style={active ? { backgroundColor: activeColor } : undefined}
    >
      {active && activeIcon ? activeIcon : icon}
      <span>
        {label}
        {cnt > 0 ? ` ${formatNum(cnt)}` : ''}
      </span>
    </button>
  );
}

function RelatedVideoCard({ video: v }: { video: RelatedVideo }) {
  return (
    <div className="flex gap-3 group cursor-pointer mb-4">
      <div className="relative flex-shrink-0 w-[140px] h-[80px] rounded-lg overflow-hidden">
        <img
          src={v.cover}
          alt={v.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded">
          {v.duration}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 group-hover:text-[#CD5700] transition-colors leading-snug">
          {v.title}
        </h4>
        <p className="text-xs text-gray-400 mt-1">{v.author}</p>
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
          <Play className="w-3 h-3" />
          {formatNum(v.views)}
        </p>
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  // API data states
  const [video, setVideo] = useState<VideoData>({
    id: 'v1',
    title: '加载中...',
    author: { name: '', avatar: '', followers: 0 },
    views: 0,
    likes: 0,
    coins: 0,
    favorites: 0,
    shares: 0,
    desc: '',
    tags: [],
    uploadTime: '',
    category: '',
  });
  const [videoUrl, setVideoUrl] = useState<string>(DEFAULT_VIDEO_URL);
  const [poster, setPoster] = useState<string>(DEFAULT_POSTER);

  // Fetch video detail
  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/videos/${id}`)
      .then(r => r.json())
      .then(data => {
        const v = data.data?.video || data.data || data;
        if (v && v.id) {
          setVideo({
            id: v.id,
            title: v.title || '无标题',
            author: {
              name: v.author?.name || v.author_name || '未知作者',
              avatar: v.author?.avatar || v.author_avatar || `https://picsum.photos/40/40?random=${v.id}`,
              followers: v.author?.followers || v.author_followers || 0,
            },
            views: v.views || v.views_count || 0,
            likes: v.likes || v.likes_count || 0,
            coins: v.coins || v.coins_count || 0,
            favorites: v.favorites || v.favorites_count || 0,
            shares: v.shares || v.shares_count || 0,
            desc: v.desc || v.description || '',
            tags: v.tags || (v.category ? [v.category] : []),
            uploadTime: v.uploadTime || v.created_at?.split('T')[0] || '',
            category: v.category || '综合',
          });
          if (v.videoUrl || v.video_url) setVideoUrl(v.videoUrl || v.video_url);
          if (v.cover || v.thumbnail_url || v.cover_url) setPoster(v.cover || v.thumbnail_url || v.cover_url);
        }
      })
      .catch(err => console.error('视频详情加载失败:', err));
  }, [id]);

  const handleSendDanmaku = useCallback(
    (d: { text: string; color: string; mode: number }) => {
      if (!id) return;
      fetch(`${API_BASE}/danmakus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, text: d.text, color: d.color, mode: d.mode }),
      }).catch(() => {});
    },
    [id]
  );

  // Send comment handler - passed via custom event or could be extended
  const handleTimeUpdate = useCallback((time: number) => {
  }, []);

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0d0d0d]">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* LEFT: Main content */}
          <div className="flex-1 min-w-0">
            {/* Video Player + Danmaku */}
            <div className="relative">
              {videoUrl.includes('player.bilibili.com') || videoUrl.includes('bvid=') ? (
                <BilibiliPlayer videoUrl={videoUrl} className="rounded-lg" />
              ) : (
                <VideoPlayer
                  ref={playerRef}
                  src={videoUrl}
                  poster={poster}
                  onTimeUpdate={handleTimeUpdate}
                >
                  <DanmakuEngine 
                    
                    videoId={id!}
                     
                  />
                </VideoPlayer>
              )}
            </div>

            {/* Video Info */}
            <div className="mt-4">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug">
                {video.title}
              </h1>

              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Play className="w-3.5 h-3.5" />
                  {formatNum(video.views)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {video.uploadTime}
                </span>
                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-[10px]">
                  {video.category}
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {video.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-0.5 text-xs text-[#CD5700] bg-[#CD5700]/10 px-2.5 py-1 rounded-full cursor-pointer hover:bg-[#CD5700]/20 transition-colors"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed line-clamp-3">
                {video.desc}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <LikeButton
                  icon={<ThumbsUp className="w-4 h-4" />}
                  activeIcon={<ThumbsUp className="w-4 h-4" fill="white" />}
                  label="点赞"
                  count={video.likes}
                />
                <LikeButton
                  icon={<Coins className="w-4 h-4" />}
                  activeIcon={<Coins className="w-4 h-4" fill="white" />}
                  label="投币"
                  count={video.coins}
                  activeColor="#FFD700"
                />
                <LikeButton
                  icon={<Star className="w-4 h-4" />}
                  activeIcon={<Star className="w-4 h-4" fill="white" />}
                  label="收藏"
                  count={video.favorites}
                  activeColor="#FFB6C1"
                />
                <LikeButton
                  icon={<Share2 className="w-4 h-4" />}
                  label="分享"
                  count={video.shares}
                  activeColor="#00BFFF"
                />
                <button className="flex items-center gap-1 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#CD5700] hover:text-[#CD5700] transition-all text-sm">
                  <MoreHorizontal className="w-4 h-4" />
                  更多
                </button>
              </div>

              {/* UP主信息 */}
              <div className="flex items-center gap-4 mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <img
                  src={video.author.avatar}
                  alt={video.author.name}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-[#CD5700]/30"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{video.author.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatNum(video.author.followers)} 粉丝
                  </p>
                </div>
                <button
                  onClick={() => setIsFollowing((v) => !v)}
                  className={`flex items-center gap-1 px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    isFollowing
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'
                      : 'bg-[#CD5700] text-white hover:bg-[#fb5b85]'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="w-4 h-4" />
                      已关注
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      关注
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Comment Section */}
            <CommentSection videoId={id!} />
          </div>

          {/* RIGHT: Related videos */}
          <div className="w-[320px] flex-shrink-0 hidden lg:block">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              推荐视频
            </h3>
            <div>
              {relatedVideos.map((v) => (
                <RelatedVideoCard key={v.id} video={v} />
              ))}
            </div>

            {/* Popular tags */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                热门标签
              </h4>
              <div className="flex flex-wrap gap-2">
                {['React', 'TypeScript', '全栈', '弹幕', 'Canvas', 'Node.js', 'PostgreSQL'].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full cursor-pointer hover:border-[#CD5700] hover:text-[#CD5700] transition-colors"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
