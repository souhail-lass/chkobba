import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/useGameStore';

/** Sits above the player hand in the flex layout (not fixed) so it scales with the viewport. */
export function TurnIndicator() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const turnStartedAt = useGameStore((s) => s.turnStartedAt);
  const turnTimeoutSec = useGameStore((s) => s.turnTimeoutSec);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!turnStartedAt || !turnTimeoutSec) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - turnStartedAt) / 1000;
      const remaining = Math.max(0, turnTimeoutSec - elapsed);
      setCountdown(Math.ceil(remaining));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [turnStartedAt, turnTimeoutSec]);

  if (!gameState || !playerId || !gameState.players) return null;

  const isMyTurn = gameState.currentTurn === playerId;
  const turnPlayer = gameState.players.find((p) => p.id === gameState.currentTurn);
  const turnName = turnPlayer
    ? turnPlayer.id === playerId
      ? "It's Your Turn!"
      : `${turnPlayer.nickname} is thinking...`
    : '';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gameState.currentTurn}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.35, type: 'spring', stiffness: 200 }}
        className="flex-shrink-0 w-full flex items-center justify-center pointer-events-none px-2 py-0 -mb-1 z-[25]"
      >
        <div className="relative w-full max-w-sm flex items-center justify-center">
          <motion.div
            animate={isMyTurn ? { opacity: [0.3, 0.7, 0.3] } : { opacity: 0.2 }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`absolute inset-0 blur-2xl ${isMyTurn ? 'bg-brass' : 'bg-black'}`}
          />

          <div
            className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-full border backdrop-blur-xl shadow-2xl flex items-center gap-2 sm:gap-3 transition-colors duration-500 max-w-[min(100%,20rem)] ${
              isMyTurn ? 'bg-brass/20 border-brass/50' : 'bg-black/60 border-white/10'
            }`}
          >
            <div className="relative flex items-center justify-center w-2 h-2 shrink-0">
              <motion.div
                animate={isMyTurn ? { scale: [1, 2.5, 1], opacity: [0.8, 0, 0.8] } : { scale: 1, opacity: 0.5 }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`absolute w-full h-full rounded-full ${isMyTurn ? 'bg-brass' : 'bg-cream/40'}`}
              />
              <div className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-brass' : 'bg-cream/40'}`} />
            </div>

            <span
              className={`font-ancient text-[11px] sm:text-base uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold truncate ${
                isMyTurn ? 'text-brass drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]' : 'text-cream-dark/60'
              }`}
            >
              {turnName}
            </span>

            {isMyTurn && countdown !== null && turnTimeoutSec !== null && (
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" title={`${countdown}s remaining`}>
                <svg className="w-7 h-7 sm:w-8 sm:h-8 -rotate-90" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(212,175,55,0.15)" strokeWidth="3" />
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="none"
                    stroke={countdown <= 10 ? '#ef4444' : 'rgba(212,175,55,0.8)'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 13}`}
                    strokeDashoffset={`${2 * Math.PI * 13 * (1 - countdown / turnTimeoutSec)}`}
                    style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.5s' }}
                  />
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center font-mono font-bold text-[9px] sm:text-[10px] ${
                    countdown <= 10 ? 'text-red-400' : 'text-brass'
                  }`}
                >
                  {countdown}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
