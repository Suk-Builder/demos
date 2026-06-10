export interface VideoItem {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  duration: number;
  views_count: number;
  likes_count: number;
  coins_count: number;
  favorites_count: number;
  danmaku_count: number;
  comments_count: number;
  category_id: string | null;
  status: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface VideoListResponse {
  success: boolean;
  data: {
    videos: VideoItem[];
    pagination: {
      total: number;
      limit: number;
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
}

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

export interface DanmakuItem {
  id: string;
  text: string;
  time: number;
  color: string;
  type: 'scroll' | 'top' | 'bottom';
  user: string;
}

