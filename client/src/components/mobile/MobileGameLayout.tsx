import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import type { RefObject } from 'react';
import type { GameState } from '@shared/types';
import { useGameStore } from '../../stores/useGameStore';
import { useEmoteStore } from '../../stores/useEmoteStore';
import { GameTable } from '../game/GameTable';
import { PlayerHand } from '../game/PlayerHand';
import { MobileScoreboard } from './MobileScoreboard';
import { MobileActionBar } from './MobileActionBar';
import { ChkobbaEffect } from '../game/ChkobbaEffect';
import { HayyaEffect } from '../game/HayyaEffect';
import { RoundEndModal } from '../game/RoundEndModal';
import { GameOverModal } from '../game/GameOverModal';
import { VintageRadio } from '../game/ambiance/VintageRadio';

interface MobileGameLayoutProps {
  tableShakeRef: RefObject<HTMLDivElement | null>;
  autoWinWarning: { timeRemaining: number; playerNickname: string } | null;
  onCopyCode: () => void;
  copied: boolean;
  gameState: GameState;
  playerId: string;
}

export function MobileGameLayout({
  tableShakeRef,
  autoWinWarning,
  onCopyCode,
  copied,
  gameState,
  playerId,
}: MobileGameLayoutProps) {
  const emoteFlashes = useEmoteStore((s) => s.flashes);

  return (
    <>
      {/* Mobile Radio - full controls */}
      <VintageRadio forceExpandedOnMobile />

      {/* 4-Row CSS Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: '60px 1fr minmax(150px, auto) 56px',
          height: '100dvh',
          maxHeight: '100dvh',
          overflow: 'hidden',
        }}
      >
        {/* Row 1: MobileScoreboard (60px) */}
        <div className="relative z-[45] overflow-hidden border-b border-brass/15">
          <MobileScoreboard />
        </div>

        {/* Row 2: GameTable (1fr) - table cards only */}
        <div className="relative z-10 min-h-0 overflow-hidden">
          <GameTable tableShakeRef={tableShakeRef} hideHand />
        </div>

        {/* Row 3: PlayerHand standalone (minmax(150px, auto)) */}
        <div className="relative z-[30] overflow-visible w-full flex items-end justify-center pb-1">
          <AnimatePresence>
            {emoteFlashes[playerId] && (
              <div
                key={`self-${emoteFlashes[playerId]!.label}`}
                className="absolute -top-1 left-1/2 z-40 -translate-x-1/2 -translate-y-full flex items-center gap-1.5 rounded-lg border border-brass/40 bg-black/85 px-2 py-1 shadow-lg pointer-events-none"
              >
                <span className="text-lg leading-none">{emoteFlashes[playerId]!.icon}</span>
                <span className="font-ancient text-[9px] text-cream uppercase tracking-wider">
                  {emoteFlashes[playerId]!.label}
                </span>
              </div>
            )}
          </AnimatePresence>
          <PlayerHand hidePlayButton />
        </div>

        {/* Row 4: MobileActionBar (56px) */}
        <div className="relative z-[80]">
          <MobileActionBar roomId={gameState.roomId} onCopyCode={onCopyCode} copied={copied} />
        </div>
      </div>

      {/* AutoWin Warning - fixed overlay */}
      {autoWinWarning && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[90] top-[max(4rem,env(safe-area-inset-top)+2rem)] copper-plate text-cream px-4 py-3 rounded-xl text-center shadow-2xl border border-brass/30 backdrop-blur-lg bg-black/60 max-w-[min(24rem,calc(100vw-1rem))]"
        >
          <p className="font-ancient text-sm text-brass/80 tracking-widest uppercase mb-1">
            {autoWinWarning.playerNickname} disconnected
          </p>
          <p className="text-xl font-ancient font-bold text-cream mb-4">
            Auto-win in {Math.round(autoWinWarning.timeRemaining / 1000)}s
          </p>
        </div>
      )}

      {/* Chkobba / Hayya effects - portal to body */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <ChkobbaEffect tableShakeRef={tableShakeRef as RefObject<HTMLElement | null>} />
            <HayyaEffect tableShakeRef={tableShakeRef as RefObject<HTMLElement | null>} />
          </>,
          document.body,
        )}

      {/* Modals */}
      <RoundEndModal />
      <GameOverModal />
    </>
  );
}
