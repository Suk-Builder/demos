import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Play, Clock, Flame, TrendingUp, Calendar } from 'lucide-react'

const API = '/api'

interface Category {
  id: number
  name: string
  slug: string
  icon: string | null
  children: Category[]
}

interface VideoItem {
  id: string
  title: string
  thumbnail_url: string
  video_url: string
  duration: number
  views_count: number
  likes_count: number
  comments_count: number
  danmaku_count: number
  category_id: string | null
  user_id: string
  created_at: string
  author?: string
}

const sortOptions = [
  { value: 'newest', label: '最新', icon: Calendar },
  { value: 'hottest', label: '最热', icon: Flame },
  { value: 'most-played', label: '最多播放', icon: TrendingUp },
] as const

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatNumber(n: number) {
  if (n >= 100000) return (n / 10000).toFixed(0) + '万'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

function VideoListItem({ v }: { v: VideoItem }) {
  return (
    <div className="group flex gap-4 rounded-lg border border-[#1a1a1e] p-3 transition-colors hover:bg-[#121214]">
      <Link to={`/video/${v.id}`} className="relative flex-shrink-0">
        <div className="relative h-[90px] w-[160px] overflow-hidden rounded-md bg-[#0a0a0f] sm:h-[100px] sm:w-[180px]">
          <img src={v.thumbnail_url} alt={v.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[11px] text-white">{formatDuration(v.duration)}</span>
        </div>
      </Link>
      <div className="flex flex-1 flex-col justify-between py-0.5">
        <Link to={`/video/${v.id}`}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[#e8e6e3] transition-colors group-hover:text-[#CD5700]">{v.title}</h3>
        </Link>
        <div className="flex items-center gap-2 text-xs text-[#5a5a5e]">
          <span className="w-5 h-5 rounded-full bg-[#CD5700]/20 flex items-center justify-center text-[10px] text-[#CD5700]">S</span>
          <span>{v.author || 'SUK_白桦'}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#5a5a5e]">
          <span className="flex items-center gap-0.5"><Play className="w-3 h-3" />{formatNumber(v.views_count)}</span>
          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{v.created_at?.slice(0, 10)}</span>
        </div>
      </div>
    </div>
  )
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()

  const [categories, setCategories] = useState<Category[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSub, setActiveSub] = useState('全部')
  const [sortBy, setSortBy] = useState<typeof sortOptions[number]['value']>('newest')

  // 获取分类列表
  useEffect(() => {
    fetch(`${API}/categories`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.categories) {
          setCategories(data.data.categories)
        }
      })
  }, [])

  const currentCategory = useMemo(() =>
    categories.find((c) => c.slug === slug) ?? categories[0],
    [slug, categories]
  )

  // 获取该分类的视频
  useEffect(() => {
    if (!currentCategory) return
    setLoading(true)
    const params = new URLSearchParams()
    params.append('page', '1')
    params.append('limit', '50')
    if (currentCategory.id) params.append('category', String(currentCategory.id))

    fetch(`${API}/videos?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const vids = data.data?.videos || data.videos || []
        setVideos(vids)
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [currentCategory])

  // 筛选+排序
  const filteredVideos = useMemo(() => {
    let list = [...videos]
    if (activeSub !== '全部') {
      list = list.filter(v => v.video_url?.includes(activeSub) || v.title?.includes(activeSub))
    }
    switch (sortBy) {
      case 'newest': list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)); break
      case 'hottest': list.sort((a, b) => b.views_count - a.views_count); break
      case 'most-played': list.sort((a, b) => b.views_count - a.views_count); break
    }
    return list
  }, [videos, activeSub, sortBy])

  if (!currentCategory) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#CD5700] border-t-transparent rounded-full animate-spin" /></div>
  }

  // 子分类标签（从分类名生成，实际应从children获取）
  const subTabs = ['全部', ...currentCategory.children?.map(c => c.name) ?? []]

  return (
    <div>
      {/* 分类导航 */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <Link key={cat.slug} to={`/category/${cat.slug}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              cat.slug === currentCategory?.slug
                ? 'bg-[#CD5700] text-white'
                : 'bg-[#121214] text-[#8a8680] hover:bg-[#1a1a1e] hover:text-[#e8e6e3]'
            }`}>
            {cat.name}
          </Link>
        ))}
      </div>

      {/* 子分类 */}
      <div className="mb-4 border-b border-[#1a1a1e]">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex items-center gap-1 pb-0">
            {subTabs.map((sub) => (
              <button key={sub} onClick={() => setActiveSub(sub)}
                className={`relative border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeSub === sub ? 'border-[#CD5700] text-[#e8e6e3]' : 'border-transparent text-[#5a5a5e] hover:text-[#e8e6e3]'
                }`}>
                {sub}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* 排序 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {sortOptions.map((opt) => {
            const Icon = opt.icon
            return (
              <button key={opt.value} onClick={() => setSortBy(opt.value)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  sortBy === opt.value ? 'bg-[#CD5700]/10 text-[#CD5700]' : 'text-[#5a5a5e] hover:text-[#e8e6e3]'
                }`}>
                <Icon className="w-3.5 h-3.5" />{opt.label}
              </button>
            )
          })}
        </div>
        <span className="text-xs text-[#5a5a5e]">共 {filteredVideos.length} 个视频</span>
      </div>

      {/* 视频列表 */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#CD5700] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filteredVideos.map(v => <VideoListItem key={v.id} v={v} />)}
          {filteredVideos.length === 0 && (
            <div className="text-center py-20 text-[#5a5a5e]">暂无视频</div>
          )}
        </div>
      )}
    </div>
  )
}

