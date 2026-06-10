import { useState, useEffect, useCallback } from 'react'
import type { Brick, WorkshopState, Session } from '@/types/baihua'

// ====== 工坊状态 ======
export function useWorkshopState() {
  const [state, setState] = useState<WorkshopState | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/workshop/state')
      const json = await res.json()
      if (json.status === 'ok') setState(json.data)
    } catch (err) {
      console.error('[WorkshopState]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateState = useCallback(async (updates: Partial<WorkshopState>) => {
    try {
      const body: Record<string, unknown> = {}
      if (updates.tea !== undefined) body.tea = updates.tea
      if (updates.cola !== undefined) body.cola = updates.cola
      if (updates.light !== undefined) body.light = updates.light
      if (updates.herPresence !== undefined) body.herPresence = updates.herPresence
      if (updates.wallThickness !== undefined) body.wallThickness = updates.wallThickness

      const res = await fetch('/api/workshop/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) await fetchState()
    } catch (err) {
      console.error('[UpdateState]', err)
    }
  }, [fetchState])

  useEffect(() => { fetchState() }, [fetchState])

  return { state, loading, updateState, refresh: fetchState }
}

// ====== 对话 ======
export function useChat() {
  const [bricks, setBricks] = useState<Brick[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const loadSession = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/sessions/${sid}/bricks`)
      const json = await res.json()
      if (json.status === 'ok') {
        setBricks(json.data)
        setSessionId(sid)
      }
    } catch (err) {
      console.error('[LoadSession]', err)
    }
  }, [])

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), session_id: sessionId }),
      })

      if (!res.ok) {
        setIsLoading(false)
        return
      }

      // 先添加用户砖块（乐观更新）
      const tempUserBrick: Brick = {
        id: Date.now(),
        session_id: sessionId || 'temp',
        sender: 'user',
        content: message.trim(),
        tags: [],
        depth: bricks.length,
        created_at: Date.now(),
      }
      setBricks(prev => [...prev, tempUserBrick])

      // 解析 SSE 流
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let baihuaContent = ''
      let doneSid = sessionId

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter(l => l.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'token') {
                  baihuaContent += data.content
                  // 更新正在生成的白桦回复
                  setBricks(prev => {
                    const filtered = prev.filter(b => b.id !== -1)
                    return [...filtered, {
                      id: -1,
                      session_id: doneSid || 'temp',
                      sender: 'baihua',
                      content: baihuaContent,
                      tags: [],
                      depth: filtered.length,
                      created_at: Date.now(),
                    }]
                  })
                } else if (data.type === 'done') {
                  doneSid = data.session_id
                  if (doneSid && !sessionId) setSessionId(doneSid)
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 最终确认：刷新会话砖块
      if (doneSid) {
        const refreshRes = await fetch(`/api/sessions/${doneSid}/bricks`)
        const refreshJson = await refreshRes.json()
        if (refreshJson.status === 'ok') {
          setBricks(refreshJson.data)
        }
      }
    } catch (err) {
      console.error('[SendMessage]', err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, bricks])

  const newSession = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      const json = await res.json()
      if (json.status === 'ok') {
        setSessionId(json.data.id)
        setBricks([])
      }
    } catch (err) {
      console.error('[NewSession]', err)
    }
  }, [])

  return { bricks, isLoading, sessionId, sendMessage, loadSession, newSession }
}

// ====== 会话列表 ======
export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      const json = await res.json()
      if (json.status === 'ok') setSessions(json.data)
    } catch (err) {
      console.error('[Sessions]', err)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  return { sessions, refresh: fetchSessions }
}
