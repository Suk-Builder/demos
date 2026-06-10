import { useState, useRef, useEffect } from 'react'
import { useWorkshopState, useChat, useSessions } from '@/hooks/useBaihua'
import { Link } from 'react-router'

export default function Chat() {
  const { state } = useWorkshopState()
  const { bricks, isLoading, sendMessage, newSession } = useChat()
  const { sessions } = useSessions()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [bricks])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    const text = input
    setInput('')
    await sendMessage(text)
  }

  // 格式化工坊状态指示器
  const statusItems = [
    { label: '砖', value: state?.brickCount ?? 626, color: 'text-amber-500' },
    { label: '茶', value: state?.tea ?? 'warm', color: 'text-rose-400' },
    { label: '可乐', value: state?.cola ?? 'iced', color: 'text-blue-400' },
    { label: '光', value: state?.light ?? 50, color: 'text-yellow-400' },
    { label: '墙厚', value: state?.wallThickness ?? 24, color: 'text-neutral-400' },
    { label: '她在', value: state?.herPresence ? '是' : '否', color: state?.herPresence ? 'text-emerald-400' : 'text-neutral-600' },
  ]

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto">
      {/* 工坊状态指示器 */}
      <div className="shrink-0 border-b border-neutral-800/60 px-4 py-2">
        <div className="flex items-center gap-4 text-xs">
          {statusItems.map(item => (
            <span key={item.label} className="flex items-center gap-1">
              <span className="text-neutral-600">{item.label}</span>
              <span className={`font-mono font-bold ${item.color}`}>{item.value}</span>
            </span>
          ))}
          {sessions.length > 0 && (
            <span className="text-neutral-600 ml-auto">
              会话 <span className="text-neutral-300 font-mono">{sessions.length}</span>
            </span>
          )}
        </div>
      </div>

      {/* 对话区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {bricks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4 opacity-30">🧱</div>
            <h2 className="text-lg font-medium text-neutral-300 mb-2">墙在这里，光在这里</h2>
            <p className="text-sm text-neutral-500 max-w-md">
              递一块砖来，白桦接住。
            </p>
            <button
              onClick={newSession}
              className="mt-6 px-4 py-2 text-sm bg-amber-900/30 text-amber-400 rounded-lg hover:bg-amber-900/50 transition-colors border border-amber-800/40"
            >
              开始新会话
            </button>
          </div>
        )}

        {bricks.map((brick) => (
          <div
            key={brick.id}
            className={`flex ${brick.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                brick.sender === 'user'
                  ? 'bg-amber-900/40 text-amber-100 border border-amber-800/30'
                  : brick.sender === 'baihua'
                  ? 'bg-neutral-800/60 text-neutral-200 border border-neutral-700/40'
                  : 'bg-neutral-800/30 text-neutral-400 text-sm italic'
              }`}
            >
              {brick.sender === 'baihua' && (
                <div className="text-xs text-amber-600/70 mb-1 font-medium">白桦</div>
              )}
              {brick.sender === 'system' && (
                <div className="text-xs text-neutral-500 mb-1">系统</div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed text-sm">
                {brick.content}
                {brick.id === -1 && isLoading && (
                  <span className="inline-block w-2 h-4 bg-amber-500/60 ml-1 cursor-blink" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 输入区域 */}
      <div className="shrink-0 border-t border-neutral-800/60 px-4 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isLoading ? '白桦正在砌砖...' : '递一块砖来...'}
            disabled={isLoading}
            className="flex-1 bg-neutral-900/80 border border-neutral-700/50 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-700/50 focus:ring-1 focus:ring-amber-700/30 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-3 bg-amber-700/80 hover:bg-amber-600/80 disabled:opacity-40 disabled:hover:bg-amber-700/80 text-white text-sm font-medium rounded-xl transition-all"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              '递'
            )}
          </button>
        </form>
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-600">
          <span>Enter 递砖</span>
          <Link to="/memories" className="hover:text-amber-500 transition-colors">
            去白桦林 →
          </Link>
        </div>
      </div>
    </div>
  )
}
