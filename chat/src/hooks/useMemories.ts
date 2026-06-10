import { useState, useEffect, useCallback } from 'react'
import type { Memory, MemoryInput } from '@/types/baihua'

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const fetchMemories = useCallback(async (params?: { category?: string; search?: string }) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (params?.category) qs.set('category', params.category)
      if (params?.search) qs.set('search', params.search)
      qs.set('limit', '100')

      const res = await fetch(`/api/memories?${qs}`)
      const json = await res.json()
      if (json.status === 'ok') {
        setMemories(json.data)
        setTotal(json.total)
      }
    } catch (err) {
      console.error('[Memories]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/memories/categories')
      const json = await res.json()
      if (json.status === 'ok') setCategories(json.data)
    } catch (err) {
      console.error('[Categories]', err)
    }
  }, [])

  const createMemory = useCallback(async (input: MemoryInput) => {
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (res.ok) {
        await fetchMemories()
        return true
      }
    } catch (err) {
      console.error('[CreateMemory]', err)
    }
    return false
  }, [fetchMemories])

  const updateMemory = useCallback(async (id: number, input: Partial<MemoryInput>) => {
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (res.ok) {
        await fetchMemories()
        return true
      }
    } catch (err) {
      console.error('[UpdateMemory]', err)
    }
    return false
  }, [fetchMemories])

  const deleteMemory = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchMemories()
        return true
      }
    } catch (err) {
      console.error('[DeleteMemory]', err)
    }
    return false
  }, [fetchMemories])

  useEffect(() => {
    fetchMemories()
    fetchCategories()
  }, [fetchMemories, fetchCategories])

  return {
    memories,
    categories,
    loading,
    total,
    fetchMemories,
    createMemory,
    updateMemory,
    deleteMemory,
    refresh: () => { fetchMemories(); fetchCategories() },
  }
}
