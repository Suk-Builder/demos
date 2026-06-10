export interface Memory {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MemoryCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: MemoryCategory[] = [
  { id: 'contact', name: '联系方式', color: '#3b82f6', icon: 'mail' },
  { id: 'interest', name: '兴趣爱好', color: '#8b5cf6', icon: 'heart' },
  { id: 'career', name: '学业职业', color: '#10b981', icon: 'briefcase' },
  { id: 'preference', name: '沟通偏好', color: '#f59e0b', icon: 'settings' },
  { id: 'personal', name: '个人信息', color: '#ef4444', icon: 'user' },
  { id: 'other', name: '其他', color: '#6b7280', icon: 'file-text' },
];

export const STORAGE_KEY = 'memory-space-data';
