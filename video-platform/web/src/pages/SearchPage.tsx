import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search, Play, Clock, X, Flame,
} from 'lucide-react'

const API = '/api'

interface VideoItem {
  id: string
  title: string
  thumbnail_url: string
  video_url: string
  duration: number
  views_count: number
  likes_count: number
  category_id?: string | null
  user_id?: string
  created_at?: string
  author?: string
}

const hotSearch = ['药物科普', '翻唱', '五朵金花', '喹硫平', '双相', 'Sukačev']

function formatNumber(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQ)
  const [inputValue, setInputValue] = useState(initialQ)
  const [results, setResults] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(!!initialQ)

  // 从API搜索
  const doSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}&page=1&limit=20`)
      const data = await res.json()
      if (data.success) {
        const videos = (data.data || []).map((v: any) => ({
          id: v.id,
          title: v.title,
          thumbnail_url: v.coverUrl || v.thumbnail_url || '/thumbnails/video_1.jpg',
          video_url: v.videoUrl || v.video_url || '',
          duration: v.duration || 0,
          views_count: v.views || v.views_count || 0,
          likes_count: v.likes || v.likes_count || 0,
          author: v.username || 'SUK_白桦',
        }))
        setResults(videos)
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  // 初始搜索
  useEffect(() => {
    if (initialQ) doSearch(initialQ)
  }, [])

  const handleSearch = () => {
    const q = inputValue.trim()
    setQuery(q)
    if (q) {
      setSearchParams({ q })
      doSearch(q)
    } else {
      setSearchParams({})
      setResults([])
      setSearched(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleHotClick = (term: string) => {
    setInputValue(term)
    setQuery(term)
    setSearchParams({ q: term })
    doSearch(term)
  }

  const clearSearch = () => {
    setInputValue('')
    setQuery('')
    setSearchParams({})
    setResults([])
    setSearched(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* 搜索栏 */}
      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[#5a5a5e]" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索视频、UP主..."
            className="h-10 rounded-lg pl-10 pr-10 text-base bg-[#1a1a1e] border-[#2a2a2e] text-[#e8e6e3] placeholder:text-[#5a5a5e]"
          />
          {inputValue && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a5e] hover:text-[#e8e6e3]">
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button className="h-10 px-6 bg-[#CD5700] hover:bg-[#b84d00] text-white" onClick={handleSearch}>
          <Search className="mr-1.5 size-4" />
          搜索
        </Button>
      </div>

      {/* 热搜 */}
      {!searched && (
        <div className="mb-6 rounded-xl border border-[#1a1a1e] bg-[#141417] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#e8e6e3] mb-3">
            <Flame className="size-4 text-[#CD5700]" />
            热搜
          </h3>
          <div className="flex flex-wrap gap-2">
            {hotSearch.map((term) => (
              <button
                key={term}
                onClick={() => handleHotClick(term)}
                className="rounded-full bg-[#1a1a1e] border border-[#2a2a2e] px-3 py-1.5 text-sm text-[#8a8580] hover:text-[#e8e6e3] hover:border-[#CD5700]/30 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 结果 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#CD5700] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-20 text-[#5a5a5e]">
          未找到与 "{query}" 相关的视频
        </div>
      ) : (
        <div className="space-y-3">
          {searched && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#8a8580]">
                "{query}" 的搜索结果 ({results.length})
              </span>
            </div>
          )}
          {results.map((v) => (
            <Link
              key={v.id}
              to={`/video/${v.id}`}
              className="group flex gap-4 rounded-xl border border-[#1a1a1e] bg-[#141417] p-3 transition-all hover:border-[#CD5700]/30 hover:bg-[#1a1a1e]"
            >
              <div className="relative flex-shrink-0">
                <div className="relative h-[90px] w-[160px] overflow-hidden rounded-md bg-[#0a0a0f] sm:h-[100px] sm:w-[180px]">
                  <img
                    src={v.thumbnail_url || '/thumbnails/video_1.jpg'}
                    alt={v.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[11px] text-white">
                    {formatDuration(v.duration)}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-between py-0.5">
                <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[#e8e6e3] transition-colors group-hover:text-[#CD5700]">
                  {v.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-[#5a5a5e]">
                  <span className="w-5 h-5 rounded-full bg-[#CD5700]/20 flex items-center justify-center text-[10px] text-[#CD5700]">S</span>
                  <span>{v.author || 'SUK_白桦'}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Play className="size-3" />{formatNumber(v.views_count)}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Clock className="size-3" />{v.created_at?.slice(0, 10)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

