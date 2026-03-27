import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore, type Screen } from '../../stores/useUIStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ChkobbaRulesContent } from './ChkobbaRulesContent';
import { socket } from '../../lib/socket';

export function LandingScreen() {
  const [nickname, setNicknameLocal] = useState(useGameStore.getState().nickname);
  const { roomId, playerId } = useGameStore((s) => ({ roomId: s.roomId, playerId: s.playerId }));
  const setNickname = useGameStore((s) => s.setNickname);
  const setScreen = useUIStore((s) => s.setScreen);
  const addToast = useUIStore((s) => s.addToast);
  const isSubmitting = useUIStore((s) => s.isSubmitting);
  const setIsSubmitting = useUIStore((s) => s.setIsSubmitting);
  const [rulesOpen, setRulesOpen] = useState(false);
  // Keep initial render deterministic for prerender + hydration.
  const [onlinePlayers, setOnlinePlayers] = useState(24);

  const validateAndProceed = (target: Screen) => {
    if (isSubmitting) return;

    const trimmed = nickname.trim();
    if (!trimmed) {
      addToast('Please enter a nickname', 'error');
      return;
    }
    if (trimmed.length < 2) {
      addToast('Nickname must be at least 2 characters', 'error');
      return;
    }
    setNickname(trimmed);

    if (target === 'createRoom') {
      setIsSubmitting(true);
      socket.emit('create_room', {
        nickname: trimmed,
        targetScore: 21,
        maxPlayers: 2,
        gameType: 'chkobba',
      });
    } else {
      setScreen(target);
    }
  };

  const handleRejoin = () => {
    if (roomId && playerId && !isSubmitting) {
      setIsSubmitting(true);
      socket.emit('rejoin_game', { roomId, playerId });
    }
  };

  useEffect(() => {
    const handleSuccess = () => setIsSubmitting(false);
    socket.on('room_joined', handleSuccess);
    return () => {
      socket.off('room_joined', handleSuccess);
    };
  }, [setIsSubmitting]);

  useEffect(() => {
    setOnlinePlayers(12 + Math.floor(Math.random() * 36));
    const id = window.setInterval(() => {
      setOnlinePlayers(12 + Math.floor(Math.random() * 36));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] relative overflow-y-auto bg-transparent flex flex-col"
      aria-labelledby="landing-title"
    >
      <h2 className="sr-only">Chkobba — online multiplayer Tunisian card game</h2>

      {/* Ambient depth — no copy, pure atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden
      >
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 h-[min(42vh,380px)] w-[min(92vw,520px)] rounded-full bg-[radial-gradient(ellipse_at_50%_40%,rgba(212,175,55,0.09)_0%,transparent_62%)] blur-sm" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
      </div>

      <div className="absolute bottom-0 left-1/4 z-[1] pointer-events-none opacity-[0.14]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="smoke-particle animate-smoke"
            style={{
              '--dur': `${4 + i}s`,
              '--delay': `${i * 0.8}s`,
              left: `${i * 20}px`,
              width: `${20 + i * 10}px`,
              height: `${20 + i * 10}px`,
            } as Record<string, string | number>}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 sm:px-8 py-12 sm:py-16 w-full max-w-[420px] mx-auto">
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mb-9 sm:mb-11 text-center w-full"
        >
          <p className="mb-3 inline-flex items-center justify-center rounded-full border border-brass/25 bg-black/25 px-3 py-1 text-[10px] font-ancient uppercase tracking-[0.28em] text-brass/80 backdrop-blur-sm">
            Multiplayer
          </p>
          <h1
            id="landing-title"
            className="text-[clamp(1.82rem,7.4vw,3.65rem)] font-black leading-[0.9] tracking-tight overflow-visible px-1 text-[#f2e4b8]"
            style={{
              textShadow:
                '0 1px 0 #6b5218, 0 3px 14px rgba(0,0,0,0.85), 0 0 28px rgba(212,175,55,0.35)',
            }}
          >
            <span className="landing-title-shimmer relative isolate inline-block uppercase tracking-[0.045em] px-[0.08em] overflow-visible">
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-b from-[#fff9e8] via-brass to-[#8a7018]">
                CHKOBBA
              </span>
            </span>
          </h1>
          <p
            className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-lg sm:text-xl text-brass/85 tabular-nums tracking-tight"
            aria-hidden
          >
            <span className="text-brass/90">♠</span>
            <span className="text-brass/35 text-xs sm:text-sm select-none">·</span>
            <span className="text-red-400/90">♥</span>
            <span className="text-brass/35 text-xs sm:text-sm select-none">·</span>
            <span className="text-brass/90">♦</span>
            <span className="text-brass/35 text-xs sm:text-sm select-none">·</span>
            <span className="text-brass/90">♣</span>
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 opacity-90">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-brass/40" aria-hidden />
            <span className="text-[10px] sm:text-xs font-ancient tracking-[0.32em] text-brass/75 uppercase">
              Cafe & cards
            </span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-brass/40" aria-hidden />
          </div>

          <p className="mt-4 text-center text-[11px] sm:text-xs font-ancient text-cream/45">
            <a
              href="/how-to-play"
              onClick={(e) => {
                e.preventDefault();
                try {
                  window.history.pushState({}, '', '/how-to-play');
                } catch {
                  /* ignore */
                }
                setScreen('howToPlay');
              }}
              className="underline decoration-white/20 underline-offset-4 hover:text-brass/90 hover:decoration-brass/40 transition-colors"
            >
              How to play (rules)
            </a>
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full rounded-[2rem] sm:rounded-[2.25rem] border border-white/[0.08] bg-black/25 backdrop-blur-xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.06)] p-7 sm:p-9 relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[120%] h-32 bg-gradient-to-b from-amber-900/15 to-transparent rounded-full blur-2xl" />
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.04]" />

          <div className="space-y-7 relative z-10">
            <Input
              label="Nickname"
              placeholder="Your name at the table…"
              value={nickname}
              onChange={setNicknameLocal}
              maxLength={15}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <div className="flex flex-col gap-3 pt-1">
              <Button
                onClick={() => validateAndProceed('createRoom')}
                disabled={isSubmitting}
                variant="brass"
                size="lg"
                className="landing-btn-brass-shimmer w-full shadow-lg shadow-black/30 !py-[1.15rem] !text-[1.02rem] !tracking-[0.19em]"
              >
                {isSubmitting ? 'Opening…' : 'Create a table'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => validateAndProceed('joinRoom')}
                disabled={isSubmitting}
                size="lg"
                className="w-full text-cream/90 hover:bg-white/[0.06] !py-4 !text-[0.98rem] !tracking-[0.16em]"
              >
                Join a room
              </Button>

              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl text-sm font-ancient text-cream/55 hover:text-brass/90 border border-transparent hover:border-brass/15 hover:bg-white/[0.03] transition-colors disabled:opacity-40"
              >
                Règles du jeu
              </button>

              <div className="flex items-center justify-center gap-2.5 pt-1 text-[11px] sm:text-xs font-ancient text-cream/45">
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                </span>
                <span>
                  <span className="tabular-nums text-cream/55">{onlinePlayers}</span>
                  {' '}
                  players online
                </span>
              </div>
            </div>

            {roomId && playerId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-5 border-t border-white/[0.06]"
              >
                <Button
                  variant="secondary"
                  onClick={handleRejoin}
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl border-brass/25"
                >
                  Resume game
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>

        <p className="mt-10 text-center text-[10px] text-cream/25 font-ancient tracking-[0.2em] uppercase">
          chkobba.app
        </p>
      </div>

      <Modal
        isOpen={rulesOpen}
        onClose={() => setRulesOpen(false)}
        panelClassName="max-w-4xl w-full text-left"
      >
        <h2 className="sr-only">Règles du Chkobba</h2>
        <ChkobbaRulesContent />
      </Modal>
    </motion.section>
  );
}
