import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../stores/useChatStore';
import { useGameStore } from '../../stores/useGameStore';
import { socket } from '../../lib/socket';
import { getAvatarUrl } from '../../utils/avatar';
import { EmotePanel } from '../game/EmotePanel';

const TUNISIAN_QUICK_CHATS = [
  'Ta7chelek 😂',
  'Khobza bb 🥵',
  'Mechlel 💀',
  'Move your ass',
  'Allah Allah',
  'ALAB YA M3ALLEM!',
];

export function ChatPanel({ hideTrigger }: { hideTrigger?: boolean } = {}) {
  const [message, setMessage] = useState('');
  const isOpen = useChatStore((s) => s.isOpen);
  const messages = useChatStore((s) => s.messages);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const toggleChat = useChatStore((s) => s.toggleChat);
  const myPlayerId = useGameStore((s) => s.playerId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > prevMessageCount.current && !isOpen) {
      try {
        const ctx = new AudioContext();
        const tone = (freq: number, start: number, dur: number) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0, start);
          g.gain.linearRampToValueAtTime(0.055, start + 0.012);
          g.gain.exponentialRampToValueAtTime(0.001, start + dur);
          o.start(start);
          o.stop(start + dur);
        };
        const t0 = ctx.currentTime;
        tone(587.33, t0, 0.1);
        tone(880, t0 + 0.06, 0.12);
      } catch {
        /* WebAudio optional */
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, isOpen]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.emit('chat_message', { message: trimmed });
    setMessage('');
  };

  const scrollQuickChat = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 150;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const cardStyle =
    'bg-[#1a3d2b] border-2 border-[#b8942f] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.45)]';

  return (
    <div className="game-laptop-density fixed bottom-[max(3.5rem,env(safe-area-inset-bottom)+2.75rem)] left-[max(0.75rem,env(safe-area-inset-left))] z-[200] flex flex-col items-start pointer-events-none max-w-[min(340px,calc(100vw-1.5rem))]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chat-panel-messages"
            initial={{ opacity: 0, x: -20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -20, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`flex flex-col w-[min(320px,calc(100vw-2rem))] sm:w-[380px] max-w-[calc(100vw-2rem)] max-h-[45vh] rounded-xl mb-3 overflow-hidden ${cardStyle} pointer-events-auto`}
            role="dialog"
            aria-label="Salon de discussion"
          >
            {/* Messages Area */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-2 min-h-[150px] custom-scrollbar mask-image-bottom"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.length === 0 && (
                <p className="text-[#c9a84c]/55 text-xs text-center italic font-body mt-auto mb-auto px-2">
                  — silence at the table —
                </p>
              )}
              {messages.map((msg, i) => {
                const isMine = !msg.isSystem && msg.playerId != null && msg.playerId === myPlayerId;
                const seed = msg.playerNickname || msg.playerId || 'guest';

                if (msg.isSystem) {
                  return (
                    <div key={i} className="text-[13px] leading-snug">
                      <span className="text-[#d4af37]/75 italic text-[11px] uppercase tracking-wider block text-center my-1">
                        — {msg.message} —
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={i}
                    className={`flex w-full gap-2 items-end ${isMine ? 'flex-row-reverse justify-end' : 'flex-row justify-start'}`}
                  >
                    <img
                      src={getAvatarUrl(seed)}
                      alt=""
                      className="w-7 h-7 rounded-full shrink-0 border border-[#b8942f]/70 shadow-sm object-cover bg-[#0f2419]"
                    />
                    <div
                      className={`min-w-0 max-w-[min(100%,14rem)] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug break-words ${
                        isMine
                          ? 'bg-[#0f2419]/90 border border-[#b8942f]/35 text-cream/95 ml-auto'
                          : 'bg-black/25 border border-[#b8942f]/25 text-cream/90'
                      }`}
                    >
                      <span className="font-ancient font-extrabold text-[#e8c76a] text-[10px] uppercase tracking-widest block mb-0.5">
                        {msg.playerNickname}
                      </span>
                      <span className="text-cream/90 font-body">{msg.message}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Chat — horizontal scroll, min-w-0 so flex does not clip */}
            <div className="relative border-t border-[#b8942f]/30 flex items-stretch min-h-[48px] bg-[#142f22]/60">
              <button
                type="button"
                onClick={() => scrollQuickChat('left')}
                className="shrink-0 z-10 w-9 bg-gradient-to-r from-[#1a3d2b] via-[#1a3d2b] to-transparent text-[#e8c76a] flex items-center justify-center border-r border-[#b8942f]/15 hover:bg-[#0f2419]/80"
                aria-label="Scroll quick chats left"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div
                ref={scrollRef}
                className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden hide-scrollbar flex flex-nowrap gap-2 py-2.5 pl-1 pr-1 scroll-smooth touch-pan-x"
              >
                {TUNISIAN_QUICK_CHATS.map((qc, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(qc)}
                    className="shrink-0 px-3 py-1.5 bg-[#0f2419]/80 hover:bg-[#142f22] text-[#e8c76a] hover:text-cream text-[11px] font-ancient font-bold rounded-full border border-[#b8942f]/40 transition-all whitespace-nowrap active:scale-95 shadow-md"
                  >
                    {qc}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => scrollQuickChat('right')}
                className="shrink-0 z-10 w-9 bg-gradient-to-l from-[#1a3d2b] via-[#1a3d2b] to-transparent text-[#e8c76a] flex items-center justify-center border-l border-[#b8942f]/15 hover:bg-[#0f2419]/80"
                aria-label="Scroll quick chats right"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Input Area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(message);
              }}
              className="flex border-t border-[#b8942f]/35 bg-[#0f2419]/90 focus-within:border-[#d4af37]/50 transition-colors"
            >
              <span className="pl-3 py-2 text-[#b8942f]/70 font-bold text-xs">ALL</span>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Press Enter to chat..."
                maxLength={100}
                className="flex-1 min-w-0 px-2 py-2 bg-transparent text-cream text-[13px] font-body focus:outline-none placeholder:text-[#c9a84c]/25"
                autoComplete="off"
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {!hideTrigger && (
        <div className="mt-2 flex flex-row items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={toggleChat}
            aria-expanded={isOpen}
            aria-controls="chat-panel-messages"
            className="relative box-border h-[36px] min-h-[36px] sm:h-[41px] sm:min-h-[41px] px-3 sm:px-5 py-2 sm:py-2.5 rounded-t-xl rounded-b-sm bg-[#1a3d2b] border-2 border-[#b8942f] text-cream/90 hover:text-white text-[10px] sm:text-[11px] font-ancient uppercase tracking-[0.15em] sm:tracking-[0.2em] cursor-pointer shadow-lg transition-all hover:bg-[#142f22] flex items-center justify-center gap-1.5 group shrink-0"
          >
            <span className="font-bold">Chat</span>
            <svg className="w-3.5 h-3.5 opacity-80 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>

            {unreadCount > 0 && !isOpen && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border border-[#1a3d2b] shadow-glow-red"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </button>

          <EmotePanel />
        </div>
      )}
    </div>
  );
}
