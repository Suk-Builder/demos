const { useState, useEffect, useRef, useCallback } = React;

const API_BASE = '';
const DEEPSEEK_API_KEY = localStorage.getItem('deepseek_api_key') || '';

// ── Components ──

function PersonaCard({ persona, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
        isActive 
          ? 'bg-white shadow-md scale-105 ring-2' 
          : 'bg-white/60 hover:bg-white hover:shadow-sm'
      }`}
      style={{ 
        ringColor: isActive ? persona.mask_color : 'transparent',
        '--tw-ring-color': persona.mask_color 
      }}
    >
      <span className="text-xl">{persona.icon}</span>
      <span className="font-medium text-gray-700">{persona.name}</span>
    </button>
  );
}

function MessageBubble({ msg, personaColor }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
          style={{ backgroundColor: personaColor + '20' }}
        >
          {msg.persona_icon || '✨'}
        </div>
      )}
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm ${
        isUser 
          ? 'bg-blue-500 text-white rounded-br-md' 
          : 'bg-white text-gray-800 rounded-bl-md'
      }`}>
        {!isUser && (
          <div className="text-xs font-medium mb-1 opacity-60">
            {msg.persona_name}
          </div>
        )}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
      </div>
    </div>
  );
}

function TypingIndicator({ color }) {
  return (
    <div className="flex gap-3 fade-in">
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
        style={{ backgroundColor: color + '20' }}
      >
        ✨
      </div>
      <div className="bg-white px-5 py-3 rounded-2xl rounded-bl-md shadow-sm">
        <div className="flex items-center h-5">
          <div className="typing-dot" style={{ backgroundColor: color }}></div>
          <div className="typing-dot" style={{ backgroundColor: color }}></div>
          <div className="typing-dot" style={{ backgroundColor: color }}></div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──

function App() {
  const [personas, setPersonas] = useState([]);
  const [currentPersona, setCurrentPersona] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(DEEPSEEK_API_KEY);
  const [showKeyInput, setShowKeyInput] = useState(!DEEPSEEK_API_KEY);
  const [switching, setSwitching] = useState(false);
  const [showPersonas, setShowPersonas] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load initial data
  useEffect(() => {
    fetch(`${API_BASE}/api/personas`).then(r => r.json()).then(setPersonas);
    fetch(`${API_BASE}/api/persona/current`).then(r => r.json()).then(setCurrentPersona);
    fetch(`${API_BASE}/api/chat/history`).then(r => r.json()).then(msgs => {
      // Transform to unified format
      const formatted = msgs.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        persona_name: m.persona_name,
        persona_icon: m.persona_icon,
        mask_color: m.mask_color,
        created_at: m.created_at
      }));
      setMessages(formatted);
    });
  }, []);

  const switchPersona = useCallback(async (personaId) => {
    setSwitching(true);
    try {
      const res = await fetch(`${API_BASE}/api/persona/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personaId ? { persona_id: personaId } : {})
      });
      const newPersona = await res.json();
      setCurrentPersona(newPersona);
      setShowPersonas(false);
    } finally {
      setTimeout(() => setSwitching(false), 600);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading || !currentPersona) return;
    if (!apiKey) { setShowKeyInput(true); return; }

    const userMsg = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // Save user message
    const userEntry = {
      id: Date.now(),
      role: 'user',
      content: userMsg,
      persona_name: currentPersona.name,
      persona_icon: currentPersona.icon,
      mask_color: currentPersona.mask_color
    };
    setMessages(prev => [...prev, userEntry]);

    await fetch(`${API_BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: userMsg })
    });

    // Call DeepSeek
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: currentPersona.system_prompt },
            ...messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg }
          ],
          stream: true
        })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      // Add placeholder for assistant
      const assistantId = Date.now() + 1;
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        persona_name: currentPersona.name,
        persona_icon: currentPersona.icon,
        mask_color: currentPersona.mask_color
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          if (line === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                ));
              }
            } catch (e) { /* ignore */ }
          }
        }
      }

      // Save assistant message to backend
      if (assistantContent) {
        await fetch(`${API_BASE}/api/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            role: 'assistant', 
            content: assistantContent,
            persona_id: currentPersona.id
          })
        });
      }

    } catch (err) {
      console.error('DeepSeek error:', err);
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        role: 'assistant',
        content: '哎呀，连接出了点问题...要不要再试一次？',
        persona_name: currentPersona.name,
        persona_icon: currentPersona.icon,
        mask_color: currentPersona.mask_color
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('deepseek_api_key', apiKey.trim());
      setShowKeyInput(false);
    }
  };

  if (!currentPersona) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4 sparkle">✨</div>
          <div className="text-lg text-gray-500">正在召唤花火...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-white/30 backdrop-blur-sm">
      {/* Header */}
      <header className="px-6 py-4 bg-white/80 backdrop-blur-md border-b border-white/50 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-md ${switching ? 'mask-switch' : ''}`}
              style={{ backgroundColor: currentPersona.mask_color + '25' }}
            >
              {currentPersona.icon}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">
                花火的多重身份剧场
              </h1>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                今日花火：
                <span style={{ color: currentPersona.mask_color }} className="font-medium">
                  {currentPersona.name}
                </span>
                <span>· {currentPersona.description}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPersonas(!showPersonas)}
              className="px-4 py-2 bg-white rounded-xl text-sm font-medium shadow-sm hover:shadow-md transition-all text-gray-600"
            >
              🎭 人格列表
            </button>
            <button
              onClick={() => switchPersona()}
              disabled={switching}
              className="px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:shadow-md transition-all text-white disabled:opacity-50"
              style={{ backgroundColor: currentPersona.mask_color }}
            >
              {switching ? '切换中...' : '🔄 换一个'}
            </button>
            <button
              onClick={() => setShowKeyInput(true)}
              className="px-3 py-2 bg-white rounded-xl text-sm shadow-sm hover:shadow-md text-gray-500"
            >
              🔑
            </button>
          </div>
        </div>

        {/* Persona list dropdown */}
        {showPersonas && (
          <div className="mt-4 p-4 bg-white rounded-2xl shadow-lg border border-gray-100 fade-in">
            <div className="text-xs text-gray-400 mb-3">点击切换人格</div>
            <div className="flex flex-wrap gap-2">
              {personas.map(p => (
                <PersonaCard
                  key={p.id}
                  persona={p}
                  isActive={p.id === currentPersona.id}
                  onClick={() => switchPersona(p.id)}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-20 fade-in">
            <div 
              className="text-8xl mb-6 inline-block"
              style={{ filter: `drop-shadow(0 4px 12px ${currentPersona.mask_color}40)` }}
            >
              {currentPersona.icon}
            </div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">
              我是{currentPersona.name}！
            </h2>
            <p className="text-gray-500 mb-6">{currentPersona.description}</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm text-gray-400 shadow-sm">
              <span>说点什么吧，我会用</span>
              <span style={{ color: currentPersona.mask_color }} className="font-medium">
                {currentPersona.name}
              </span>
              <span>的方式回应你</span>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble 
            key={msg.id} 
            msg={msg} 
            personaColor={msg.mask_color || '#f472b6'} 
          />
        ))}

        {isLoading && <TypingIndicator color={currentPersona.mask_color} />}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="px-4 py-4 bg-white/80 backdrop-blur-md border-t border-white/50">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={`和${currentPersona.name}说点什么...`}
            className="flex-1 px-5 py-3 bg-white rounded-2xl border-0 shadow-sm focus:outline-none focus:ring-2 text-sm text-gray-700 placeholder-gray-400"
            style={{ '--tw-ring-color': currentPersona.mask_color }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="px-6 py-3 rounded-2xl text-white font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-40 text-sm"
            style={{ backgroundColor: currentPersona.mask_color }}
          >
            {isLoading ? '✨' : '发送'}
          </button>
        </form>
        <div className="text-center mt-2 text-xs text-gray-400">
          当前人格：{currentPersona.name} · 点击"换一个"随机切换人格
        </div>
      </footer>

      {/* API Key Modal */}
      {showKeyInput && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-2">设置 DeepSeek API Key</h3>
            <p className="text-sm text-gray-500 mb-6">
              花火需要 DeepSeek API 来生成回复。你的 API Key 只存储在本地浏览器中，不会发送到我们的服务器。
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-400 text-sm mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowKeyInput(false)}
                className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all"
              >
                取消
              </button>
              <button
                onClick={saveApiKey}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-400 to-purple-400 rounded-xl text-sm font-medium text-white hover:shadow-lg transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
