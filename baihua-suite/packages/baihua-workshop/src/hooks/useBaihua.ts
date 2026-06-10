import { useState, useEffect, useCallback } from 'react';
import type { Brick, WorkshopState } from '@/types/baihua';

const STORAGE_KEY = 'baihua-workshop';

const defaultState: WorkshopState = {
  brickCount: 626,
  tea: 'warm',
  cola: 'iced',
  light: 50,
  herPresence: true,
  wallThickness: 24,
};

export function useBaihua() {
  const [bricks, setBricks] = useState<Brick[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY + '-bricks');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const [state, setState] = useState<WorkshopState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY + '-state');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return defaultState;
  });

  const [apiConfig, setApiConfig] = useState<{provider: string, apiKey: string, model: string}>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY + '-api');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { provider: 'deepseek', apiKey: '[REDACTED]', model: 'deepseek-chat' };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '-bricks', JSON.stringify(bricks));
  }, [bricks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '-state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '-api', JSON.stringify(apiConfig));
  }, [apiConfig]);

  const addBrick = useCallback((content: string, sender: 'user' | 'baihua') => {
    const newBrick: Brick = {
      id: Date.now(),
      content,
      sender,
      timestamp: Date.now(),
    };
    setBricks(prev => [...prev, newBrick]);
    setState(prev => ({
      ...prev,
      brickCount: prev.brickCount + 1,
    }));
    return newBrick;
  }, []);

  const clearBricks = useCallback(() => {
    setBricks([]);
    setState(defaultState);
  }, []);

  const updateApiConfig = useCallback((config: {provider?: string, apiKey?: string, model?: string}) => {
    setApiConfig(prev => ({ ...prev, ...config }));
  }, []);

  return {
    bricks,
    state,
    apiConfig,
    addBrick,
    clearBricks,
    updateApiConfig,
    setState,
  };
}
