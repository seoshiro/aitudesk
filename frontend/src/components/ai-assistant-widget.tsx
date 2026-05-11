import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, X, Loader2, BookOpen } from 'lucide-react';
import axios from 'axios';
import { api } from '@/api/axios';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { id: string; title: string; category: string }[];
}

interface ChatResponse {
  reply: string;
  sources?: { id: string; title: string; category: string }[];
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    'Здравствуйте. Я ассистент AituDesk на базе ИИ. Отвечаю по статьям базы знаний колледжа. Задайте вопрос — например, «как подключить принтер» или «почему не работает Wi-Fi».',
};

export function AIAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const history = next
        .slice(-8)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      const resp = await api.post<ChatResponse>('/ai/chat', {
        message: text,
        history,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: resp.data.reply || '—',
          sources: resp.data.sources,
        },
      ]);
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string; detail?: string } | undefined)
        : null;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            detail?.detail ??
            detail?.error ??
            'Не удалось получить ответ от ИИ. Попробуйте позже или создайте заявку вручную.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const reset = () => {
    setMessages([INITIAL_MESSAGE]);
    setInput('');
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'fixed z-40 bottom-6 right-6 inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-full',
            'border border-foreground/90 bg-foreground text-background',
            'shadow-[0_8px_24px_-12px_oklch(0.22_0.025_260_/_0.5)]',
            'hover:bg-foreground/90 transition-colors',
            'text-[12.5px] font-medium tracking-[0.01em]',
          )}
          aria-label="Открыть ИИ-ассистент"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          ИИ-ассистент
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            'fixed z-50 bottom-6 right-6 flex flex-col',
            'w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-3rem))]',
            'bg-card text-card-foreground border border-border rounded-lg',
            'shadow-[0_24px_60px_-24px_oklch(0.22_0.025_260_/_0.45)]',
            'overflow-hidden',
          )}
          role="dialog"
          aria-label="ИИ-ассистент AituDesk"
        >
          {/* Header — editorial masthead */}
          <header className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  § AI · AituDesk
                </div>
                <h2 className="mt-1 font-serif text-[18px] leading-[1.15] tracking-[-0.01em]">
                  Технический ассистент
                </h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={reset}
                  className="h-7 px-2 rounded text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title="Очистить переписку"
                >
                  Сброс
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </header>

          {/* Transcript */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 bg-background/40"
          >
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} index={i} />
            ))}

            {loading && (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Ассистент
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-2 w-1/2 rounded bg-muted animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-border bg-card p-3">
            <div className="relative flex items-end gap-2 rounded border border-border bg-background focus-within:border-foreground/60 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                disabled={loading}
                placeholder="Спросите о настройке, доступе, ошибке…"
                className="flex-1 min-w-0 resize-none bg-transparent px-3 py-2.5 text-[13.5px] leading-[1.45] outline-none placeholder:text-muted-foreground max-h-32"
                style={{ fontFamily: 'inherit' }}
              />
              <button
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className={cn(
                  'mr-1.5 mb-1.5 grid h-8 w-8 place-items-center rounded',
                  'bg-foreground text-background',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'hover:bg-foreground/90 transition-colors',
                )}
                aria-label="Отправить"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Send className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Enter — отправить · Shift+Enter — новая строка
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.role === 'user';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {isUser ? 'Вы' : 'Ассистент'}
        </span>
        <span className="font-mono text-[9.5px] text-muted-foreground/70">
          № {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div
        className={cn(
          'text-[13.5px] leading-[1.55] whitespace-pre-wrap text-pretty',
          isUser
            ? 'rounded border-l-2 border-foreground/80 bg-card px-3 py-2'
            : 'rounded border-l-2 border-border bg-background/60 px-3 py-2 font-serif',
        )}
      >
        {message.content}
      </div>

      {!isUser && message.sources && message.sources.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <BookOpen className="h-3 w-3" strokeWidth={1.75} />
            Источники
          </span>
          {message.sources.map((s) => (
            <a
              key={s.id}
              href={`/kb/${s.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center h-5 px-1.5 rounded border border-border bg-card text-[10.5px] text-foreground/80 hover:border-foreground/60 hover:text-foreground transition-colors"
              title={s.title}
            >
              {s.title.length > 32 ? s.title.slice(0, 32) + '…' : s.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
