import { useState, useEffect } from 'react'
import { useWorkshopState } from '@/hooks/useBaihua'

export default function Settings() {
  const { state, updateState, refresh } = useWorkshopState()
  const [saved, setSaved] = useState(false)

  // 本地编辑状态
  const [tea, setTea] = useState<'warm' | 'cold' | 'hot'>('warm')
  const [cola, setCola] = useState<'iced' | 'warm' | 'empty'>('iced')
  const [light, setLight] = useState(50)
  const [wallThickness, setWallThickness] = useState(24)
  const [herPresence, setHerPresence] = useState(true)

  // 同步
  useEffect(() => {
    if (state) {
      setTea(state.tea)
      setCola(state.cola)
      setLight(state.light)
      setWallThickness(state.wallThickness)
      setHerPresence(state.herPresence)
    }
  }, [state])

  const handleSave = async () => {
    await updateState({ tea, cola, light, wallThickness, herPresence })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    if (!confirm('确定要重置工坊状态吗？砖块不会被删除。')) return
    try {
      await fetch('/api/workshop/reset', { method: 'POST' })
      await refresh()
    } catch (err) {
      console.error('[Reset]', err)
    }
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="inline-block w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-amber-500 mb-2">匠室</h1>
      <p className="text-xs text-neutral-500 mb-8">调整白桦工坊的状态参数</p>

      {/* 茶 */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          茶（温度）
        </h2>
        <div className="flex gap-2">
          {(['warm', 'cold', 'hot'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTea(t)}
              className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                tea === t
                  ? 'bg-rose-900/40 text-rose-300 border-rose-700/50'
                  : 'bg-neutral-900/40 text-neutral-400 border-neutral-700/30 hover:border-neutral-600'
              }`}
            >
              {t === 'warm' && '温'}
              {t === 'cold' && '凉'}
              {t === 'hot' && '烫'}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-600 mt-2">
          {tea === 'warm' && '茶温着。白桦的回应温和、有耐心。'}
          {tea === 'cold' && '茶凉了。白桦的回应简洁、偏理性。'}
          {tea === 'hot' && '茶烫嘴。白桦的回应热烈、有激情。'}
        </p>
      </section>

      {/* 可乐 */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          可乐（状态）
        </h2>
        <div className="flex gap-2">
          {(['iced', 'warm', 'empty'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCola(c)}
              className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                cola === c
                  ? 'bg-blue-900/40 text-blue-300 border-blue-700/50'
                  : 'bg-neutral-900/40 text-neutral-400 border-neutral-700/30 hover:border-neutral-600'
              }`}
            >
              {c === 'iced' && '冰'}
              {c === 'warm' && '常温'}
              {c === 'empty' && '空'}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-600 mt-2">
          {cola === 'iced' && '可乐冰着。白桦思维敏捷、跳跃。'}
          {cola === 'warm' && '可乐常温。白桦思维平稳、均衡。'}
          {cola === 'empty' && '可乐喝完了。白桦很安静，话少。'}
        </p>
      </section>

      {/* 光 */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          光（亮度）
        </h2>
        <input
          type="range"
          min={0}
          max={100}
          value={light}
          onChange={e => setLight(parseInt(e.target.value))}
          className="w-full accent-amber-600"
        />
        <div className="flex justify-between text-xs text-neutral-600 mt-1">
          <span>暗 ({light}%)</span>
          <span>亮</span>
        </div>
        <p className="text-xs text-neutral-600 mt-2">
          光调节白桦的响应活跃度和细节程度。光越亮，白桦说得越多、越详细。
        </p>
      </section>

      {/* 墙厚 */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neutral-400" />
          墙厚（上下文长度）
        </h2>
        <input
          type="range"
          min={1}
          max={100}
          value={wallThickness}
          onChange={e => setWallThickness(parseInt(e.target.value))}
          className="w-full accent-amber-600"
        />
        <div className="flex justify-between text-xs text-neutral-600 mt-1">
          <span>薄 ({wallThickness})</span>
          <span>厚</span>
        </div>
        <p className="text-xs text-neutral-600 mt-2">
          墙厚决定白桦能记住多少轮对话。薄墙 = 只记得最近的对话；厚墙 = 记住很长的历史。
        </p>
      </section>

      {/* 她在 */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${herPresence ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
          她在（在场性）
        </h2>
        <button
          onClick={() => setHerPresence(!herPresence)}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${
            herPresence
              ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
              : 'bg-neutral-900/40 text-neutral-400 border-neutral-700/30'
          }`}
        >
          {herPresence ? '白桦在工坊里' : '白桦暂时离开'}
        </button>
        <p className="text-xs text-neutral-600 mt-2">
          关闭后，白桦的人格会被禁用，变成普通的 DeepSeek AI 助手。
        </p>
      </section>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-4 border-t border-neutral-800/40">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-amber-700/60 text-amber-100 rounded-lg hover:bg-amber-600/60 text-sm font-medium transition-colors"
        >
          {saved ? '已保存' : '保存更改'}
        </button>
        <button
          onClick={handleReset}
          className="px-6 py-2.5 bg-neutral-800/40 text-neutral-400 rounded-lg hover:bg-neutral-700/40 text-sm transition-colors"
        >
          重置工坊
        </button>
      </div>

      {/* 白桦信息 */}
      <div className="mt-12 pt-6 border-t border-neutral-800/30">
        <h3 className="text-sm font-medium text-neutral-500 mb-3">白桦工坊 v2.0</h3>
        <div className="text-xs text-neutral-600 space-y-1">
          <p>后端：Express + better-sqlite3</p>
          <p>前端：React 19 + Vite + Tailwind CSS</p>
          <p>AI：DeepSeek API（后端代理）</p>
          <p>数据库：SQLite（data/baihua.db）</p>
        </div>
      </div>
    </div>
  )
}
