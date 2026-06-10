import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Play,
  Clock,
  Heart,
  MessageSquare,
  UserPlus,
  Check,
  Home,
  Film,
  Bookmark,
  Rss,
} from 'lucide-react'

/* ─── mock ─── */
const upUser = {
  id: 'u1',
  name: 'SUK_白桦',
  avatar: 'https://picsum.photos/80/80?random=ymm',
  banner: '#18191c',
  bio: '裂缝·递砖·建造者 | BDI 150+ | 农民的儿子 | 21岁全栈开发者',
  level: 6,
  followers: 9714,
  following: 41,
  videos: [
    { id: 'v1', title: '6小时极限挑战：从零搭建一个React组件库', cover: 'https://picsum.photos/320/180?random=1', views: 12400, duration: '12:34', date: '2024-01-15', likes: 892 },
    { id: 'v2', title: '裂缝递砖建造者：一个关于BDI 150+的故事', cover: 'https://picsum.photos/320/180?random=2', views: 35600, duration: '18:22', date: '2024-02-03', likes: 2103 },
    { id: 'v3', title: '双相情感障碍患者的自我疗愈指南', cover: 'https://picsum.photos/320/180?random=3', views: 8920, duration: '25:10', date: '2024-02-28', likes: 1567 },
    { id: 'v4', title: 'MyGO!!!!!! 剧情深度解析与角色心理剖析', cover: 'https://picsum.photos/320/180?random=4', views: 45200, duration: '32:45', date: '2024-03-12', likes: 3400 },
    { id: 'v5', title: '农民的儿子：从山村到全栈开发者的十年', cover: 'https://picsum.photos/320/180?random=5', views: 67800, duration: '15:50', date: '2024-04-01', likes: 5200 },
    { id: 'v6', title: 'Sukačev 架构设计：高并发视频平台的技术选型', cover: 'https://picsum.photos/320/180?random=6', views: 23100, duration: '22:18', date: '2024-04-20', likes: 1890 },
  ],
}

const tabItems = [
  { value: 'home', label: '主页', icon: Home },
  { value: 'videos', label: '投稿', icon: Film },
  { value: 'favorites', label: '收藏', icon: Bookmark },
  { value: 'activity', label: '动态', icon: Rss },
]

/* ─── helpers ─── */
function formatNumber(n: number) {
  return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n)
}

/* ─── video card ─── */
function VideoCard({ v }: { v: typeof upUser.videos[0] }) {
  return (
    <div className="group cursor-pointer">
      <Link to={`/video/${v.id}`}>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          <img
            src={v.cover}
            alt={v.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 py-0.5 text-[11px] text-white">
            {v.duration}
          </span>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="rounded-full bg-black/50 p-2">
              <Play className="size-5 text-white" fill="white" />
            </div>
          </div>
        </div>
      </Link>
      <div className="mt-2">
        <Link to={`/video/${v.id}`}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
            {v.title}
          </h3>
        </Link>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Play className="size-3" />
            {formatNumber(v.views)}
          </span>
          <span className="flex items-center gap-0.5">
            <Heart className="size-3" />
            {formatNumber(v.likes)}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="size-3" />
            {v.date}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── page ─── */
export default function SpacePage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState('videos')
  const [isFollowing, setIsFollowing] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* ── banner ── */}
      <div
        className="h-[200px] w-full md:h-[240px]"
        style={{ backgroundColor: upUser.banner }}
      >
        <div className="h-full w-full bg-gradient-to-b from-transparent via-transparent to-black/30" />
      </div>

      {/* ── profile header ── */}
      <div className="mx-auto max-w-5xl px-4">
        <div className="relative -mt-12 flex flex-col gap-4 pb-6 md:-mt-10 md:flex-row md:items-end">
          {/* avatar */}
          <Avatar className="size-20 ring-4 ring-background md:size-[80px]">
            <AvatarImage src={upUser.avatar} alt={upUser.name} />
            <AvatarFallback className="text-lg">{upUser.name.slice(0, 2)}</AvatarFallback>
          </Avatar>

          {/* info */}
          <div className="flex flex-1 flex-col gap-1 md:pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{upUser.name}</h1>
              <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                Lv{upUser.level}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{upUser.bio}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                <strong className="font-semibold text-foreground">{formatNumber(upUser.following)}</strong>{' '}
                关注
              </span>
              <span>
                <strong className="font-semibold text-foreground">{formatNumber(upUser.followers)}</strong>{' '}
                粉丝
              </span>
            </div>
          </div>

          {/* follow btn */}
          <Button
            variant={isFollowing ? 'outline' : 'default'}
            size="sm"
            className="gap-1.5 self-start md:self-auto"
            onClick={() => setIsFollowing((p) => !p)}
          >
            {isFollowing ? (
              <>
                <Check className="size-4" />
                已关注
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                关注
              </>
            )}
          </Button>
        </div>

        {/* ── tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="h-10 w-full justify-start rounded-none border-b bg-transparent p-0">
            {tabItems.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <t.icon className="mr-1.5 size-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── tab: home ── */}
          <TabsContent value="home" className="mt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <h2 className="mb-4 text-lg font-semibold">最新投稿</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {upUser.videos.slice(0, 4).map((v) => (
                    <VideoCard key={v.id} v={v} />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">个人资料</h2>
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  <p>ID: {id ?? upUser.id}</p>
                  <p className="mt-1">等级: Lv{upUser.level}</p>
                  <p className="mt-1">粉丝: {formatNumber(upUser.followers)}</p>
                  <p className="mt-1">关注: {formatNumber(upUser.following)}</p>
                  <p className="mt-3 text-xs leading-relaxed">{upUser.bio}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── tab: videos ── */}
          <TabsContent value="videos" className="mt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upUser.videos.map((v) => (
                <VideoCard key={v.id} v={v} />
              ))}
            </div>
          </TabsContent>

          {/* ── tab: favorites ── */}
          <TabsContent value="favorites" className="mt-6">
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Bookmark className="mb-3 size-12 opacity-30" />
              <p className="text-sm">收藏夹暂无公开内容</p>
            </div>
          </TabsContent>

          {/* ── tab: activity ── */}
          <TabsContent value="activity" className="mt-6">
            <div className="space-y-4">
              {upUser.videos.slice(0, 3).map((v) => (
                <div
                  key={v.id}
                  className="flex gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30"
                >
                  <img
                    src={v.cover}
                    alt={v.title}
                    className="h-20 w-36 flex-shrink-0 rounded-md object-cover"
                  />
                  <div className="flex flex-col justify-center">
                    <h3 className="text-sm font-medium">{v.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      投稿了视频 · {v.date}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Play className="size-3" /> {formatNumber(v.views)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="size-3" /> {formatNumber(Math.floor(v.views * 0.02))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
