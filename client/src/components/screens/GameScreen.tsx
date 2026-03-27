import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/useGameStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import { GameTable } from '../game/GameTable';
import { Scoreboard } from '../game/Scoreboard';
import { MoveLog } from '../game/MoveLog';
import { ChkobbaEffect } from '../game/ChkobbaEffect';
import { HayyaEffect } from '../game/HayyaEffect';
import { RoundEndModal } from '../game/RoundEndModal';
import { GameOverModal } from '../game/GameOverModal';
import { VintageRadio } from '../game/ambiance/VintageRadio';
import { useAmbianceSound } from '../../hooks/useAmbianceSound';
import { RummyGameScreen } from '../game/RummyGameScreen';
import { useUIStore } from '../../stores/useUIStore';
import { socket } from '../../lib/socket';
import { Button } from '../ui/Button';
import { SoundEffectsControls } from '../game/SoundEffectsControls';
import { MobileGameLayout } from '../mobile/MobileGameLayout';

export function GameScreen() {
  const gameState = useGameStore((s) => s.gameState);
  const rummyGameState = useGameStore((s) => s.rummyGameState);
  const gameType = useGameStore((s) => s.gameType || s.room?.gameType);
  const playerId = useGameStore((s) => s.playerId);
  const autoWinWarning = useGameStore((s) => s.autoWinWarning);
  const isDistributing = useGameStore((s) => s.isDistributing);
  const isMobile = useIsMobile();

  const { playClink, playLighter, playCardShuffle } = useAmbianceSound();
  const lighterPlayed = useRef(false);
  const prevRound = useRef(gameState?.roundNumber ?? 0);
  const [copied, setCopied] = useState(false);
  const tableShakeRef = useRef<HTMLDivElement | null>(null);

  // Play lighter flick once on first mount
  useEffect(() => {
    if (!lighterPlayed.current) {
      lighterPlayed.current = true;
      const t = setTimeout(() => playLighter(), 600);
      return () => clearTimeout(t);
    }
  }, [playLighter]);

  // Ensure shuffle plays when distributing state turns on (failsafe for first round)
  useEffect(() => {
    if (isDistributing) {
      playCardShuffle();
    }
  }, [isDistributing, playCardShuffle]);

  // Play clink on round start (Chkobba only)
  useEffect(() => {
    if (gameState && gameState.roundNumber !== prevRound.current) {
      prevRound.current = gameState.roundNumber;
      playClink();
    }
  }, [gameState?.roundNumber, playClink, gameState]);

  if (gameType === 'rummy' || rummyGameState) {
    return <RummyGameScreen />;
  }

  // Handle loading state
  if (!gameState || !playerId || !gameState.players) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#1a120e]">
        <div className="w-12 h-12 border-4 border-brass border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-brass font-ancient animate-pulse uppercase tracking-widest">Preparing Table...</p>
      </div>
    );
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gameState.roomId);
    setCopied(true);
    useUIStore.getState().addToast('Room code copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Mobile layout (< 640px)
  if (isMobile) {
    return (
      <motion.section
        id="game-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="h-[100dvh] max-h-[100dvh] relative overflow-hidden bg-transparent"
      >
        {/* Ambient lighting divs — same as desktop */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.06) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(90,53,32,0.15) 0%, transparent 40%)'
        }} />
        <div className="absolute top-0 right-10 w-40 h-40 bg-amber-900/8 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-32 h-32 bg-turquoise/3 rounded-full blur-[100px] pointer-events-none" />

        <MobileGameLayout
          tableShakeRef={tableShakeRef}
          autoWinWarning={autoWinWarning}
          onCopyCode={handleCopyCode}
          copied={copied}
          gameState={gameState}
          playerId={playerId}
        />
      </motion.section>
    );
  }

  return (
    <motion.section
      id="game-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="game-laptop-density h-[100dvh] max-h-[100dvh] min-h-0 flex flex-col px-1 pt-1 sm:px-2 sm:pt-2 pb-0 relative overflow-x-hidden bg-transparent"
    >
      {/* Cinematic Background (Provided by App.tsx) */}
      
      {/* Ambient cafe lighting */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.06) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(90,53,32,0.15) 0%, transparent 40%)'
      }} />
      <div className="absolute top-0 right-10 w-40 h-40 bg-amber-900/8 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-32 h-32 bg-turquoise/3 rounded-full blur-[100px] pointer-events-none" />

      {/* Vintage Radio - Minimized icon on mobile, full widget on md+ */}
      <VintageRadio />

      {/* Scoreboard */}
      <Scoreboard />
      
      {/* Action Log — Desktop only */}
      <MoveLog />

      {/* SFX + room code — top right on mobile (below scoreboard), bottom right on sm+ */}
      <div className="fixed top-[max(9.5rem,env(safe-area-inset-top)+9rem)] sm:top-auto sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-[45] flex flex-col gap-1.5 w-[min(11rem,calc(100vw-5rem))] sm:w-[min(16rem,calc(100vw-8rem))]">
        <SoundEffectsControls />
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          className="inline-flex w-full items-center justify-center gap-2 bg-black/40 backdrop-blur-md border border-brass/20 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-black/60 transition-colors group relative shadow-inner-dark min-h-[36px]"
          onClick={handleCopyCode}
        >
          <AnimatePresence>
            {copied && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: -25 }}
                exit={{ opacity: 0 }}
                className="absolute left-0 right-0 text-center pointer-events-none"
              >
                <span className="bg-brass text-black text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter shadow-glow-gold">Copied!</span>
              </motion.div>
            )}
          </AnimatePresence>
          <span className="text-[10px] text-brass/60 font-ancient uppercase tracking-widest shrink-0">Room:</span>
          <span className="text-xs text-brass font-mono font-bold tracking-wider tabular-nums shrink min-w-0 max-w-[11rem] truncate text-center">
            {gameState.roomId}
          </span>
          <svg className="w-3 h-3 text-brass/40 group-hover:text-brass transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        </motion.button>
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-x-hidden overflow-y-visible min-w-0">
        <GameTable tableShakeRef={tableShakeRef} />
      </div>

      {autoWinWarning && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed left-1/2 -translate-x-1/2 z-40 copper-plate text-cream px-4 sm:px-6 py-3 sm:py-4 rounded-xl text-center shadow-2xl border border-brass/30 backdrop-blur-lg bg-black/60 max-w-[min(24rem,calc(100vw-1rem))] top-[max(4.5rem,env(safe-area-inset-top)+3rem)]"
        >
          <p className="font-ancient text-sm text-brass/80 tracking-widest uppercase mb-1">{autoWinWarning.playerNickname} disconnected</p>
          <p className="text-xl font-ancient font-bold text-cream mb-4">
            Auto-win in {Math.round(autoWinWarning.timeRemaining / 1000)}s
          </p>
          <Button size="sm" variant="secondary" onClick={() => {
            if (window.confirm('End match and return to lobby?')) {
              socket.emit('reset_game');
            }
          }} className="w-full">Return to Lobby</Button>
        </motion.div>
      )}

      {/* Chkobba / Hayya must render above Chat (z-200) + other UI — portal to body */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <ChkobbaEffect tableShakeRef={tableShakeRef as RefObject<HTMLElement | null>} />
            <HayyaEffect tableShakeRef={tableShakeRef as RefObject<HTMLElement | null>} />
          </>,
          document.body,
        )}

      <RoundEndModal />
      <GameOverModal />
    </motion.section>
  );
}
