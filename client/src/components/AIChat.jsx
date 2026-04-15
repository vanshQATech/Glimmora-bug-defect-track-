import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import api from '../utils/api';

const WELCOME = {
  role: 'assistant',
  content:
    "Hi! I'm the **Glimmora DefectDesk Assistant**. Ask me anything about your bugs, tasks, projects, workspace, or how to use the platform.",
};

function renderMarkdown(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-ink-100 text-brand-700 text-[12px]">$1</code>')
    .replace(/\n/g, '<br/>');
}

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError('');
    const nextHistory = [...messages, { role: 'user', content: text }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', {
        message: text,
        history: nextHistory.filter(m => m !== WELCOME).slice(0, -1),
      });
      setMessages(m => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to reach the AI assistant.';
      setError(msg);
      setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const reset = () => {
    setMessages([WELCOME]);
    setError('');
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-brand-gradient text-white shadow-pop flex items-center justify-center hover:scale-105 transition"
          title="Ask Glimmora DefectDesk Assistant"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-pop border border-ink-100 flex flex-col overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 bg-brand-gradient text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">DefectDesk Assistant</div>
                <div className="text-[10px] text-white/70 uppercase tracking-wider">Glimmora AI</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                className="text-[11px] text-white/80 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                title="New chat"
              >
                Clear
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-white/10" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-ink-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-brand-gradient text-white rounded-br-sm'
                      : 'bg-white border border-ink-100 text-ink-900 rounded-bl-sm shadow-sm'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-ink-100 px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm">
                  <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-ink-100 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder="Ask about your bugs, tasks, projects…"
                disabled={loading}
                className="flex-1 resize-none px-3 py-2 rounded-xl border border-ink-200 bg-ink-50 focus:bg-white text-[13px] placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 disabled:opacity-60"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="h-10 w-10 flex-shrink-0 rounded-xl bg-brand-gradient text-white flex items-center justify-center shadow-card disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-ink-400 mt-1.5 text-center">
              Scoped to Glimmora DefectDesk features only.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
