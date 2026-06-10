import { useState } from 'react'
import { useMemories } from '@/hooks/useMemories'
import type { MemoryInput } from '@/types/baihua'

export default function Memories() {
  const { memories, categories, loading, total, createMemory, updateMemory, deleteMemory, refresh } = useMemories()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  const [form, setForm] = useState<MemoryInput>({
    title: '',
    content: '',
    category: '其他',
    tags: [],
    priority: 0,
  })

  const handleSearch = () => {
    refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.content) return

    if (editing !== null) {
      await updateMemory(editing, form)
      setEditing(null)
    } else {
      await createMemory(form)
    }

    setForm({ title: '', content: '', category: '其他', tags: [], priority: 0 })
    setShowForm(false)
  }

  const handleEdit = (m: typeof memories[0]) => {
    setForm({
      title: m.title,
      content: m.content,
      category: m.category,
      tags: m.tags,
      priority: m.priority,
    })
    setEditing(m.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要移除这块砖吗？')) return
    await deleteMemory(id)
  }

  // 分类颜色
  const categoryColors: Record<string, string> = {
    '学业职业': 'bg-blue-900/40 text-blue-300 border-blue-800/40',
    '个人信息': 'bg-emerald-900/40 text-emerald-300 border-emerald-800/40',
    '吃书档案': 'bg-purple-900/40 text-purple-300 border-purple-800/40',
    '兴趣爱好': 'bg-pink-900/40 text-pink-300 border-pink-800/40',
    'AI教训': 'bg-red-900/40 text-red-300 border-red-800/40',
    '沟通偏好': 'bg-yellow-900/40 text-yellow-300 border-yellow-800/40',
    '其他': 'bg-neutral-800/60 text-neutral-300 border-neutral-700/40',
  }

  const displayedMemories = memories.filter(m => {
    if (filterCategory && m.category !== filterCategory) return false
    if (search) {
      const s = search.toLowerCase()
      return m.title.toLowerCase().includes(s) || m.content.toLowerCase().includes(s)
    }
    return true
  })

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto px-4 py-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-amber-500">白桦林</h1>
          <p className="text-xs text-neutral-500 mt-1">
            {total} 块砖嵌在墙上
            {filterCategory && ` · 分类：${filterCategory}`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ title: '', content: '', category: '其他', tags: [], priority: 0 }) }}
          className="px-4 py-2 text-sm bg-amber-800/40 text-amber-400 rounded-lg hover:bg-amber-800/60 transition-colors border border-amber-700/40"
        >
          {showForm ? '取消' : '砌砖'}
        </button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索白桦林..."
          className="flex-1 bg-neutral-900/80 border border-neutral-700/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-700/50"
        />
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="bg-neutral-900/80 border border-neutral-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-700/50"
        >
          <option value="">全部分类</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* 新建/编辑表单 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-neutral-900/50 border border-neutral-700/40 rounded-xl space-y-3">
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="砖的标题"
            className="w-full bg-neutral-800/60 border border-neutral-700/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-700/50"
            required
          />
          <textarea
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="砖的内容..."
            rows={4}
            className="w-full bg-neutral-800/60 border border-neutral-700/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-700/50 resize-none"
            required
          />
          <div className="flex gap-3">
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="bg-neutral-800/60 border border-neutral-700/40 rounded-lg px-3 py-2 text-sm"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="其他">其他</option>
            </select>
            <input
              type="number"
              value={form.priority}
              onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
              placeholder="优先级"
              min={0}
              max={10}
              className="w-24 bg-neutral-800/60 border border-neutral-700/40 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-amber-700/60 text-amber-100 rounded-lg hover:bg-amber-600/60 text-sm transition-colors"
            >
              {editing !== null ? '更新' : '砌入墙中'}
            </button>
          </div>
        </form>
      )}

      {/* 记忆列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="inline-block w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : displayedMemories.length === 0 ? (
        <div className="text-center py-20 text-neutral-500">
          <p>白桦林空空如也</p>
        </div>
      ) : (
        <div className="grid gap-3 overflow-y-auto">
          {displayedMemories.map(memory => (
            <div
              key={memory.id}
              className="p-4 bg-neutral-900/40 border border-neutral-800/40 rounded-xl hover:border-neutral-700/60 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[memory.category] || categoryColors['其他']}`}>
                      {memory.category}
                    </span>
                    {memory.priority > 0 && (
                      <span className="text-xs text-amber-500 font-mono">P{memory.priority}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-neutral-200 mb-1">{memory.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">{memory.content}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(memory)}
                    className="p-1.5 text-neutral-500 hover:text-amber-400 hover:bg-amber-900/20 rounded transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                  >
                    移除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
