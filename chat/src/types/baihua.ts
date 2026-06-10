// ====== 砖块 ======
export interface Brick {
  id: number;
  session_id: string;
  sender: 'user' | 'baihua' | 'system';
  content: string;
  tags: string[];
  depth: number;
  created_at: number;
}

// ====== 记忆 ======
export interface Memory {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  priority: number;
  source: string;
  created_at: number;
  updated_at: number;
}

export interface MemoryInput {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  priority?: number;
}

// ====== 工坊状态 ======
export interface WorkshopState {
  brickCount: number;
  tea: 'warm' | 'cold' | 'hot';
  cola: 'iced' | 'warm' | 'empty';
  light: number;
  herPresence: boolean;
  wallThickness: number;
  currentSessionId: string | null;
}

// ====== 会话 ======
export interface Session {
  id: string;
  title: string;
  brick_count: number;
  status: 'active' | 'archived' | 'deleted';
  created_at: number;
  updated_at: number;
}

// ====== 白桦语言标记 ======
export interface BaihuaMarkers {
  opening: string[];
  closing: string[];
  receiving: string[];
  metaphors: {
    brick: string;
    wall: string;
    light: string;
    tea: string;
    cola: string;
    workshop: string;
    forest: string;
    path: string;
    her: string;
  };
}

// ====== API 响应 ======
export interface ApiResponse<T> {
  status: 'ok';
  data: T;
}

export interface HealthResponse {
  status: string;
  version: string;
  brickCount: number;
  memoryCount: number;
  message: string;
}
