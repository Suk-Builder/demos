import { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { API_BASE } from '../api/client';

export interface CommentItem {
  id: string;
  content: string;
  user: string;
  avatar: string;
  time: string;
  likes: number;
  liked: boolean;
  disliked: boolean;
  replies: CommentItem[];
}

interface CommentSectionProps {
  videoId: string;
}

const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23CD5700"/><text x="20" y="25" text-anchor="middle" fill="white" font-size="16">U</text></svg>';

export default function CommentSection({ videoId }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'hot' | 'time'>('hot');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const replyInputRef = useRef<HTMLInputElement>(null);

  // 从API获取评论
  useEffect(() => {
    if (!videoId) return;
    setLoading(true);
    fetch(`${API_BASE}/comments?videoId=${videoId}&page=1&limit=50`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.comments) {
          const apiComments = data.data.comments.map((c: any) => ({
            id: c.id || String(Math.random()),
            content: c.content || '',
            user: c.username || c.user_id || '匿名用户',
            avatar: defaultAvatar,
            time: c.created_at ? new Date(c.created_at).toLocaleDateString() : '刚刚',
            likes: c.likes_count || 0,
            liked: false,
            disliked: false,
            replies: [],
          }));
          setComments(apiComments);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [videoId]);

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'hot') return b.likes - a.likes;
    return 0;
  });

  const handleLike = (id: string) => {
    setComments(prev => prev.map(c => {
      if (c.id === id) return { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 };
      return c;
    }));
  };

  const handleDislike = (id: string) => {
    setComments(prev => prev.map(c => {
      if (c.id === id) return { ...c, disliked: !c.disliked };
      return c;
    }));
  };

  const handleReply = (id: string) => {
    setReplyTo(replyTo === id ? null : id);
    setReplyText('');
    setTimeout(() => replyInputRef.current?.focus(), 50);
  };

  const submitReply = (parentId: string) => {
    if (!replyText.trim()) return;
    const newReply: CommentItem = {
      id: `reply_${Date.now()}`,
      content: replyText,
      user: 'SUK_白桦',
      avatar: defaultAvatar,
      time: '刚刚',
      likes: 0,
      liked: false,
      disliked: false,
      replies: [],
    };
    setComments(prev => prev.map(c => {
      if (c.id === parentId) return { ...c, replies: [...c.replies, newReply] };
      return c;
    }));
    setReplyText('');
    setReplyTo(null);
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    const newComment: CommentItem = {
      id: `comment_${Date.now()}`,
      content: commentText,
      user: 'SUK_白桦',
      avatar: defaultAvatar,
      time: '刚刚',
      likes: 0,
      liked: false,
      disliked: false,
      replies: [],
    };
    setComments(prev => [newComment, ...prev]);
    setCommentText('');
  };

  const toggleReplies = (id: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="py-8 text-center text-[#8a8580]">加载评论中...</div>;
  }

  return (
    <div className="rounded-xl border border-[#2a2a2e] bg-[#141417] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#e8e6e3] font-semibold text-base">
          评论 <span className="text-[#8a8580] text-sm ml-1">{comments.length}</span>
        </h3>
        <div className="flex gap-2 text-sm">
          <button
            className={`px-3 py-1 rounded-full transition-colors ${sortBy === 'hot' ? 'bg-[#CD5700]/20 text-[#CD5700]' : 'text-[#8a8580] hover:text-[#e8e6e3]'}`}
            onClick={() => setSortBy('hot')}
          >按热度</button>
          <button
            className={`px-3 py-1 rounded-full transition-colors ${sortBy === 'time' ? 'bg-[#CD5700]/20 text-[#CD5700]' : 'text-[#8a8580] hover:text-[#e8e6e3]'}`}
            onClick={() => setSortBy('time')}
          >按时间</button>
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-3 mb-6">
        <div className="w-9 h-9 rounded-full bg-[#CD5700]/20 flex items-center justify-center text-sm text-[#CD5700] font-bold shrink-0">S</div>
        <div className="flex-1 flex gap-2">
          <input
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitComment()}
            placeholder="发条友善的评论吧~"
            className="flex-1 h-9 bg-[#1a1a1e] border border-[#2a2a2e] rounded-full px-4 text-sm text-[#e8e6e3] placeholder:text-[#5a5a5e] outline-none focus:border-[#CD5700]/50"
          />
          <button
            onClick={submitComment}
            className="h-9 px-4 bg-[#CD5700] text-white text-sm rounded-full hover:bg-[#b84d00] transition-colors disabled:opacity-50"
            disabled={!commentText.trim()}
          >发送</button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {sortedComments.map(comment => (
          <div key={comment.id} className="flex gap-3 group">
            <img src={comment.avatar} className="w-9 h-9 rounded-full bg-[#1a1a1e] shrink-0" alt="" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-[#e8e6e3]">{comment.user}</span>
              <p className="text-[13px] text-[#8a8580] mt-1 leading-relaxed">{comment.content}</p>
              <div className="flex items-center gap-4 mt-2 text-[12px] text-[#5a5a5e]">
                <span>{comment.time}</span>
                <button onClick={() => handleLike(comment.id)} className={`flex items-center gap-1 hover:text-[#CD5700] ${comment.liked ? 'text-[#CD5700]' : ''}`}><ThumbsUp className="w-3.5 h-3.5" />{comment.likes}</button>
                <button onClick={() => handleDislike(comment.id)} className={`hover:text-[#8a8580] ${comment.disliked ? 'text-[#8a8580]' : ''}`}><ThumbsDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleReply(comment.id)} className="hover:text-[#CD5700] flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />回复</button>
                {comment.replies.length > 0 && (
                  <button onClick={() => toggleReplies(comment.id)} className="text-[#CD5700]">
                    {comment.replies.length}条回复{expandedReplies.has(comment.id) ? '▲' : '▼'}
                  </button>
                )}
              </div>
              {replyTo === comment.id && (
                <div className="flex gap-2 mt-2">
                  <input ref={replyInputRef} value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitReply(comment.id)} placeholder={`回复 @${comment.user}...`} className="flex-1 h-8 bg-[#1a1a1e] border border-[#2a2a2e] rounded-full px-3 text-sm text-[#e8e6e3] outline-none focus:border-[#CD5700]/50" />
                  <button onClick={() => submitReply(comment.id)} className="h-8 px-3 bg-[#CD5700] text-white text-sm rounded-full">发送</button>
                </div>
              )}
              {expandedReplies.has(comment.id) && comment.replies.length > 0 && (
                <div className="mt-3 pl-3 border-l border-[#2a2a2e] space-y-3">
                  {comment.replies.map(reply => (
                    <div key={reply.id} className="flex gap-2.5">
                      <img src={reply.avatar} className="w-8 h-8 rounded-full bg-[#1a1a1e] shrink-0" alt="" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[#e8e6e3]">{reply.user}</span>
                        <p className="text-[13px] text-[#8a8580] mt-1 leading-relaxed">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

