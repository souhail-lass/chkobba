import type { Player } from '@shared/types.js';
import { Card } from './Card';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerZoneProps {
  player: Player;
  position: 'top' | 'left' | 'right';
  isCurrentTurn?: boolean;
  isTeammate?: boolean;
  emoteBubble?: { icon: string; label: string } | null;
}

export function PlayerZone({
  player,
  position,
  isCurrentTurn = false,
  isTeammate = false,
  emoteBubble = null,
}: PlayerZoneProps) {
  const isVertical = position === 'left' || position === 'right';

  // Team colors
  const teamColors = {
    0: 'border-amber-500/60 bg-amber-900/20',
    1: 'border-teal-500/60 bg-teal-900/20'
  };

  // Card fan spread based on position
  const getCardTransform = (index: number, total: number) => {
    const mid = (total - 1) / 2;
    const offset = index - mid;

    if (isVertical) {
      return {
        rotate: position === 'left' ? 90 + offset * 5 : -90 + offset * 5,
        x: offset * 3,
        y: offset * 12,
      };
    }
    // Top position: cards fan horizontally
    return {
      rotate: offset * 5,
      x: 0,
      y: Math.abs(offset) * 3,
    };
  };

  return (
    <div className={`relative flex ${isVertical ? 'flex-row' : 'flex-col'} items-center gap-2`}>
      <AnimatePresence>
        {emoteBubble && (
          <motion.div
            key={`${emoteBubble.label}-${emoteBubble.icon}`}
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="absolute -top-10 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-lg border border-brass/40 bg-black/85 px-2 py-1 shadow-lg pointer-events-none flex items-center gap-1.5"
          >
            <span className="text-base leading-none">{emoteBubble.icon}</span>
            <span className="font-ancient text-[9px] sm:text-[10px] text-cream uppercase tracking-wider">
              {emoteBubble.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Nameplate with team indicator */}
      <motion.div
        animate={isCurrentTurn ? {
          boxShadow: ['0 0 0px #d4af37', '0 0 14px #d4af37', '0 0 0px #d4af37'],
        } : { boxShadow: '0 0 0px transparent' }}
        transition={{ duration: 2, repeat: isCurrentTurn ? Infinity : 0 }}
        className={`wood-nameplate px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg flex items-center gap-1 sm:gap-2 border-t-2 ${
          teamColors[player.team as keyof typeof teamColors] || 'border-cream-dark/25'
        } ${!player.isConnected ? 'opacity-40 grayscale' : ''}`}
      >
        {/* Turn dot: gold when active, green when connected, red when disconnected */}
        <motion.div
          animate={isCurrentTurn ? { scale: [1, 1.4, 1] } : { scale: 1 }}
          transition={{ duration: 1.5, repeat: isCurrentTurn ? Infinity : 0 }}
          className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${
            isCurrentTurn
              ? 'bg-brass shadow-[0_0_6px_rgba(212,175,55,0.8)]'
              : player.isConnected
                ? 'bg-green-400'
                : 'bg-red-400/50'
          }`}
        />
        <span
          className="font-ancient text-[9px] sm:text-[10px] md:text-[11px] text-brass font-bold min-w-0 max-w-[min(11rem,28vw)] sm:max-w-[min(12rem,22vw)] truncate"
          title={player.nickname}
        >
          {player.nickname}
        </span>
        {/* Team indicator badge */}
        <span className={`text-[6px] sm:text-[7px] font-ancient font-bold uppercase tracking-wider px-1 py-0.5 rounded shrink-0 ${
          player.team === 0
            ? 'bg-amber-600/80 text-black'
            : 'bg-teal-600/80 text-black'
        }`}>
          T{player.team + 1}
        </span>
        {isCurrentTurn && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[7px] sm:text-[8px] font-ancient text-brass/70 uppercase tracking-wider shrink-0 whitespace-nowrap"
          >
            playing
          </motion.span>
        )}
        {player.capturedCount > 0 && (
          <span className="text-[9px] font-ancient text-cream-dark/50 bg-black/20 px-1 rounded shrink-0">
            {player.capturedCount}
          </span>
        )}
      </motion.div>

      {/* Face-down cards */}
      {player.handCount > 0 && (
        <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} justify-center items-center pointer-events-none ${
          isVertical ? '-space-y-10' : '-space-x-6 sm:-space-x-8'
        } h-16 sm:h-20`}>
          {Array.from({ length: player.handCount }).map((_, i) => {
            const transform = getCardTransform(i, player.handCount);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                style={{
                  transform: `rotate(${transform.rotate}deg) translateX(${transform.x}px)`,
                  zIndex: i,
                }}
              >
                <Card faceDown small />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
