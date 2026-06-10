import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User,
  FileVideo,
  Heart,
  History,
  Bell,
  Upload,
  Trash2,
  Play,
  Clock,
  MessageSquare,
  Save,
  LogOut,
  ChevronRight,
  Settings,
  X,
  Eye,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
interface Video {
  id: string;
  title: string;
  cover: string;
  views: string;
  date: string;
  duration?: string;
  category?: string;
}

const mockMyVideos: Video[] = [
  { id: 'v1', title: '【动画】夏日冒险记 第3话', cover: 'https://picsum.photos/seed/v1/320/180', views: '1.2万', date: '2024-01-15', duration: '12:34', category: '动画' },
  { id: 'v2', title: '【翻唱】夜に駆ける / YOASOBI', cover: 'https://picsum.photos/seed/v2/320/180', views: '8,532', date: '2024-01-10', duration: '4:21', category: '音乐' },
  { id: 'v3', title: 'React 19 新特性全解析', cover: 'https://picsum.photos/seed/v3/320/180', views: '3.4万', date: '2024-01-05', duration: '18:45', category: '科技' },
  { id: 'v4', title: '独立游戏开发日志 #7', cover: 'https://picsum.photos/seed/v4/320/180', views: '5,102', date: '2023-12-28', duration: '15:02', category: '游戏' },
];

const mockFavorites: Video[] = [
  { id: 'f1', title: '【纪录片】深海世界探秘', cover: 'https://picsum.photos/seed/f1/320/180', views: '56万', date: '2024-01-12', duration: '45:20', category: '知识' },
  { id: 'f2', title: '【MV】米津玄師 - Lemon', cover: 'https://picsum.photos/seed/f2/320/180', views: '3.2亿', date: '2024-01-08', duration: '4:15', category: '音乐' },
  { id: 'f3', title: '【教程】Blender 入门到精通', cover: 'https://picsum.photos/seed/f3/320/180', views: '12万', date: '2024-01-01', duration: '2:30:00', category: '知识' },
];

const mockHistory: Video[] = [
  { id: 'h1', title: '【动画】夏日冒险记 第2话', cover: 'https://picsum.photos/seed/h1/320/180', views: '9,876', date: '今天 14:30', duration: '12:15' },
  { id: 'h2', title: '【VLOG】东京一日游', cover: 'https://picsum.photos/seed/h2/320/180', views: '2.1万', date: '今天 10:15', duration: '15:40' },
  { id: 'h3', title: 'Python 数据分析实战', cover: 'https://picsum.photos/seed/h3/320/180', views: '8.9万', date: '昨天 22:00', duration: '35:20' },
  { id: 'h4', title: '【游戏】塞尔达传说实况 #5', cover: 'https://picsum.photos/seed/h4/320/180', views: '3.4万', date: '昨天 18:45', duration: '42:10' },
  { id: 'h5', title: '【科普】量子力学入门', cover: 'https://picsum.photos/seed/h5/320/180', views: '67万', date: '3天前', duration: '20:05' },
];

interface Notification {
  id: string;
  title: string;
  content: string;
  time: string;
  read: boolean;
  type: 'system' | 'like' | 'comment';
}

const mockNotifications: Notification[] = [
  { id: 'n1', title: '系统维护通知', content: 'Sukačev 将于1月20日凌晨2:00-4:00进行系统维护，期间部分功能可能不可用。', time: '2小时前', read: false, type: 'system' },
  { id: 'n2', title: '新功能上线', content: '投稿功能现已全面开放，快来分享你的创作吧！', time: '昨天', read: false, type: 'system' },
  { id: 'n3', title: '有人赞了你的视频', content: '用户 "动漫达人" 赞了你的视频《夏日冒险记 第3话》', time: '2天前', read: true, type: 'like' },
  { id: 'n4', title: '新评论', content: '用户 "程序猿" 评论了你的视频："讲得太好了，期待更新！"', time: '3天前', read: true, type: 'comment' },
  { id: 'n5', title: '账号安全提醒', content: '检测到你在新设备上登录，如非本人操作，请立即修改密码。', time: '5天前', read: true, type: 'system' },
];

/* ------------------------------------------------------------------ */
/*  Menu items                                                         */
/* ------------------------------------------------------------------ */
type TabKey = 'info' | 'videos' | 'favorites' | 'history' | 'notifications';

const menuItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'info', label: '我的信息', icon: <User className="w-4 h-4" /> },
  { key: 'videos', label: '我的投稿', icon: <FileVideo className="w-4 h-4" /> },
  { key: 'favorites', label: '我的收藏', icon: <Heart className="w-4 h-4" /> },
  { key: 'history', label: '历史记录', icon: <History className="w-4 h-4" /> },
  { key: 'notifications', label: '消息通知', icon: <Bell className="w-4 h-4" /> },
];

/* ================================================================== */
export default function ProfilePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // User info state
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { id: 'u1', name: '用户', email: '' };

  const [nickname, setNickname] = useState(user.name || 'Sukačev用户');
  const [bio, setBio] = useState('这个用户很懒，什么都没有写~');
  const [email, setEmail] = useState(user.email || 'user@example.com');
  const [avatarUrl, setAvatarUrl] = useState(`https://api.dicebear.com/9.x/avataaars/svg?seed=${user.id}`);

  // Videos
  const [myVideos, setMyVideos] = useState<Video[]>(mockMyVideos);
  const [favorites, setFavorites] = useState<Video[]>(mockFavorites);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  // History with clear all support
  const [history, setHistory] = useState<Video[]>(mockHistory);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- actions ---- */
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      toast.success('头像上传成功！');
    }
  };

  const handleSaveInfo = () => {
    localStorage.setItem('user', JSON.stringify({ ...user, name: nickname, email }));
    toast.success('个人信息保存成功！');
  };

  const handleDeleteVideo = (id: string) => {
    setMyVideos((prev) => prev.filter((v) => v.id !== id));
    toast.success('视频已删除');
  };

  const handleRemoveFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((v) => v.id !== id));
    toast.success('已取消收藏');
  };

  const handleClearHistory = () => {
    setHistory([]);
    toast.success('历史记录已清空');
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('全部标记为已读');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('已退出登录');
    navigate('/');
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  /* ---- render ---- */
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 py-4 md:py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 md:gap-6">

        {/* ---- Left Sidebar (desktop) / Top (mobile) ---- */}
        <aside className="md:w-56 shrink-0">
          {/* Mobile: horizontal scroll */}
          <div className="md:hidden flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); setMobileMenuOpen(false); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === item.key
                    ? 'bg-[#CD5700] text-white shadow-md shadow-pink-200'
                    : 'bg-white text-gray-600 hover:bg-pink-50'
                }`}
              >
                {item.icon}
                {item.label}
                {item.key === 'notifications' && unreadCount > 0 && (
                  <span className="ml-0.5 bg-white text-[#CD5700] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Desktop: vertical menu */}
          <div className="hidden md:block bg-white rounded-2xl border shadow-sm sticky top-20 overflow-hidden">
            <div className="p-4 text-center border-b">
              <Avatar className="w-16 h-16 mx-auto mb-2 cursor-pointer ring-2 ring-pink-100" onClick={handleAvatarClick}>
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-pink-100 text-[#b84d00] text-xl">
                  {nickname.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold text-gray-900 truncate">{nickname}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
            <nav className="p-2 space-y-0.5">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === item.key
                      ? 'bg-pink-50 text-[#b84d00]'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.key === 'notifications' && unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
                      {unreadCount}
                    </Badge>
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTab === item.key ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              ))}
            </nav>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </Button>
            </div>
          </div>
        </aside>

        {/* ---- Main Content ---- */}
        <main className="flex-1 min-w-0">

          {/* ============ 我的信息 ============ */}
          {activeTab === 'info' && (
            <div className="bg-white rounded-2xl border shadow-sm p-5 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-5 h-5 text-[#CD5700]" />
                <h2 className="text-lg font-bold text-gray-900">我的信息</h2>
              </div>

              <div className="flex flex-col items-center mb-8">
                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                  <Avatar className="w-24 h-24 ring-4 ring-pink-100">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-pink-100 text-[#b84d00] text-3xl">
                      {nickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <p className="text-sm text-muted-foreground mt-2">点击上传头像</p>
              </div>

              <div className="space-y-5 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="profile-nickname">昵称</Label>
                  <Input
                    id="profile-nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">邮箱</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-bio">个性签名</Label>
                  <Textarea
                    id="profile-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <Button
                  onClick={handleSaveInfo}
                  className="bg-[#CD5700] hover:bg-[#b84d00] text-white rounded-xl px-8"
                >
                  <Save className="w-4 h-4 mr-2" />
                  保存修改
                </Button>
              </div>
            </div>
          )}

          {/* ============ 我的投稿 ============ */}
          {activeTab === 'videos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileVideo className="w-5 h-5 text-[#CD5700]" />
                  我的投稿
                  <Badge variant="secondary">{myVideos.length}</Badge>
                </h2>
                <Button
                  className="bg-[#CD5700] hover:bg-[#b84d00] text-white rounded-xl"
                  size="sm"
                  onClick={() => navigate('/upload')}
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  投稿
                </Button>
              </div>
              {myVideos.length === 0 ? (
                <div className="bg-white rounded-2xl border shadow-sm p-12 text-center">
                  <FileVideo className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">暂无投稿视频</p>
                  <Button
                    className="mt-4 bg-[#CD5700] hover:bg-[#b84d00] text-white"
                    onClick={() => navigate('/upload')}
                  >
                    去投稿
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-white rounded-xl border shadow-sm overflow-hidden group hover:shadow-md transition-shadow"
                    >
                      <div className="relative aspect-video cursor-pointer" onClick={() => navigate(`/video/${video.id}`)}>
                        <img
                          src={video.cover}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                          {video.duration}
                        </div>
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-sm text-gray-900 line-clamp-1" title={video.title}>
                          {video.title}
                        </h3>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {video.views}
                          </span>
                          <span>{video.date}</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={() => navigate(`/video/${video.id}`)}
                          >
                            查看
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                            onClick={() => handleDeleteVideo(video.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ 我的收藏 ============ */}
          {activeTab === 'favorites' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Heart className="w-5 h-5 text-[#CD5700]" />
                我的收藏
                <Badge variant="secondary">{favorites.length}</Badge>
              </h2>
              {favorites.length === 0 ? (
                <div className="bg-white rounded-2xl border shadow-sm p-12 text-center">
                  <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">暂无收藏视频</p>
                  <Button
                    className="mt-4 bg-[#CD5700] hover:bg-[#b84d00] text-white"
                    onClick={() => navigate('/')}
                  >
                    去发现
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {favorites.map((video) => (
                    <div
                      key={video.id}
                      className="bg-white rounded-xl border shadow-sm overflow-hidden group hover:shadow-md transition-shadow"
                    >
                      <div className="relative aspect-video cursor-pointer" onClick={() => navigate(`/video/${video.id}`)}>
                        <img
                          src={video.cover}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                          {video.duration}
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-sm text-gray-900 line-clamp-1" title={video.title}>
                          {video.title}
                        </h3>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {video.views}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveFavorite(video.id)}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            取消收藏
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ 历史记录 ============ */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-[#CD5700]" />
                  历史记录
                  <Badge variant="secondary">{history.length}</Badge>
                </h2>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleClearHistory}>
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    清空
                  </Button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="bg-white rounded-2xl border shadow-sm p-12 text-center">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">暂无观看记录</p>
                  <Button
                    className="mt-4 bg-[#CD5700] hover:bg-[#b84d00] text-white"
                    onClick={() => navigate('/')}
                  >
                    去看视频
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((video) => (
                    <div
                      key={video.id}
                      className="bg-white rounded-xl border shadow-sm p-3 flex gap-3 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => navigate(`/video/${video.id}`)}
                    >
                      <div className="relative w-36 md:w-44 shrink-0 aspect-video rounded-lg overflow-hidden">
                        <img
                          src={video.cover}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded">
                          {video.duration}
                        </div>
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <h3 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-[#b84d00] transition-colors">
                          {video.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {video.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {video.views}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ 消息通知 ============ */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#CD5700]" />
                  消息通知
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                      {unreadCount} 未读
                    </Badge>
                  )}
                </h2>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                    全部已读
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {notifications.map((note) => (
                  <div
                    key={note.id}
                    className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${
                      !note.read ? 'border-pink-200 bg-pink-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                          note.type === 'system'
                            ? 'bg-blue-100 text-blue-600'
                            : note.type === 'like'
                            ? 'bg-pink-100 text-[#b84d00]'
                            : 'bg-green-100 text-green-600'
                        }`}
                      >
                        {note.type === 'system' ? (
                          <Bell className="w-4 h-4" />
                        ) : note.type === 'like' ? (
                          <Heart className="w-4 h-4" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-medium ${!note.read ? 'text-gray-900' : 'text-gray-700'}`}>
                            {note.title}
                          </h3>
                          {!note.read && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-[#CD5700]" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {note.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">{note.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
