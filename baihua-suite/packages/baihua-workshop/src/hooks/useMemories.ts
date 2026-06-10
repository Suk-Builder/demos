import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY, DEFAULT_CATEGORIES } from '@/types/memory';
import type { Memory } from '@/types/memory';

const defaultMemories: Memory[] = [
  {
    id: '1',
    title: 'ProtonMail 邮箱',
    content: 'ShiroBirch@protonmail.com，用于 Upwork 等平台注册及对外联系。',
    category: 'contact',
    tags: ['邮箱', 'Upwork'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: '2',
    title: '动画电影《超时空辉夜姬》',
    content: '2026年Netflix原创动画电影，导演山下清悟。涉及时间穿越、虚拟世界、仿生人、百合。关键设定：辉夜姬是月球电子生命，飞船损坏穿越回八千年前成为八千代，形成时间闭环；最后彩叶为八千代制作仿生身体，苏醒的辉夜是八千代意识的投射。用户提到"仿生人"对应此剧情。',
    category: 'interest',
    tags: ['动画', '电影', 'Netflix'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: '3',
    title: '北大 MPH 考研计划',
    content: '用户计划考北大MPH（公共卫生硕士），与医疗/心理学/精神病学相关方向。软件工程大三背景，对精神病理有深入研究。',
    category: 'career',
    tags: ['考研', '北大', '公共卫生'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: '4',
    title: '沟通偏好：不要插嘴',
    content: '不要插嘴，不要话还没说完就判断，先听完对方说完再回应。',
    category: 'preference',
    tags: ['沟通', '红线'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: '5',
    title: '沟通偏好：说人话',
    content: '默认说人话，不说体系黑话。不要把正常对话变成术语轰炸，把具体的人抽象成概念零件。用户生气就是生气，要钱就是要钱，觉得烦就是觉得烦，不要翻译成"B系统残余""递砖剂量""认知滤网过载"等体系黑话。',
    category: 'preference',
    tags: ['沟通', '术语', '红线'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: '6',
    title: 'GitHub 账号',
    content: 'GitHub: https://github.com/Suk-Builder（UID: 283328760）。个人网站: https://sukaczev.top。',
    category: 'personal',
    tags: ['GitHub', '网站'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '7',
    title: '白桦思想体系（Builder System）',
    content: '用户自创的思想体系，以"裂缝—递砖—建造者"为三元核心。104篇核心文本，9大主题域，24大元概念。横跨认知测量、精神病理、教育批判、文明动力学、政治哲学、AI认知、文学实验场与极限伦理。9大域：I认知测量与工具层、II精神病理与天才谱系、III教育文化与产业批判、IV文明末日与生存动力学、V政治哲学与历史诊断、VI AI认知与人机交互、VII文学哲学评论与实验场、VIII生存暴力与极限伦理。GitHub仓库: https://github.com/Suk-Builder/Builder-System',
    category: 'personal',
    tags: ['思想体系', 'Builder-System', '白桦'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '8',
    title: 'BDI 验证框架',
    content: 'Builder Density Instrument — 生产级认知画像系统。AI驱动的对话引擎，测量builder密度的3个维度（概念压缩、认知诚实、跨域共振）。多阶段状态机：身份确认→流体IQ测试→核心探测→报告生成。含实时排行榜、统计聚合、会话持久化、完整对话历史。技术栈：Node.js, Express, PostgreSQL, REST API, DashScope AI, Nginx, PM2。在线演示：https://sukaczev.top/gf-test.html。GitHub仓库：https://github.com/Suk-Builder/bdi-validation-framework',
    category: 'personal',
    tags: ['BDI', '项目', '全栈', 'AI'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '9',
    title: '技术栈与能力',
    content: '全栈开发能力。前端：HTML/JavaScript/TypeScript。后端：Node.js, Express, PostgreSQL, REST API。AI集成：DashScope（阿里百炼API，含自动重试和降级机制）。运维：Nginx, PM2, Shell脚本部署（含Python自动化部署脚本）。熟悉GitHub工作流，2026年5月活跃度极高（45次提交）。',
    category: 'career',
    tags: ['技术栈', '全栈', 'Node.js', 'AI'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '10',
    title: '核心关注领域',
    content: '认知测量与画像、精神病理与天才谱系、教育产业批判、文明末日动力学、政治哲学与历史诊断、AI认知拓扑与人机交互、极限伦理与生存暴力。对"建造者密度"（Builder Density）有原创性的测量框架。关注个体在系统压力下的认知诚实性与概念压缩能力。',
    category: 'personal',
    tags: ['认知科学', '精神病理', 'AI', '哲学'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load memories:', e);
    }
    return defaultMemories;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
    } catch (e) {
      console.error('Failed to save memories:', e);
    }
  }, [memories]);

  const addMemory = useCallback((memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newMemory: Memory = {
      ...memory,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setMemories((prev) => [newMemory, ...prev]);
    return newMemory;
  }, []);

  const updateMemory = useCallback((id: string, updates: Partial<Omit<Memory, 'id' | 'createdAt'>>) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m))
    );
  }, []);

  const deleteMemory = useCallback((id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const exportToJson = useCallback(() => {
    const data = {
      memories,
      categories: DEFAULT_CATEGORIES,
      exportedAt: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-space-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [memories]);

  const exportToMarkdown = useCallback(() => {
    const lines = ['# 用户记忆档案', '', `> 导出时间：${new Date().toLocaleString()}`, ''];
    
    DEFAULT_CATEGORIES.forEach((cat) => {
      const catMemories = memories.filter((m) => m.category === cat.id);
      if (catMemories.length === 0) return;
      
      lines.push(`## ${cat.name}`, '');
      catMemories.forEach((m) => {
        lines.push(`### ${m.title}`, '', m.content, '');
        if (m.tags.length > 0) {
          lines.push(`标签：${m.tags.join('、')}`, '');
        }
        lines.push('---', '');
      });
    });
    
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-space-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [memories]);

  const importFromJson = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.memories && Array.isArray(data.memories)) {
            setMemories(data.memories);
            resolve();
          } else {
            reject(new Error('无效的记忆数据格式'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }, []);

  return {
    memories,
    addMemory,
    updateMemory,
    deleteMemory,
    exportToJson,
    exportToMarkdown,
    importFromJson,
    categories: DEFAULT_CATEGORIES,
  };
}
