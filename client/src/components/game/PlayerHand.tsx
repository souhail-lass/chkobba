import { useGameStore } from '../../stores/useGameStore';
import { socket } from '../../lib/socket';
import { Card } from './Card';
import { motion, AnimatePresence } from 'framer-motion';
import { useAmbianceSound } from '../../hooks/useAmbianceSound';
import { stopCelebrationPlayback } from '../../lib/playAssetSound';
import { useRef, useEffect, useState, useCallback } from 'react';
import gsap from 'gsap';

export function PlayerHand({ hidePlayButton }: { hidePlayButton?: boolean } = {}) {
  const { gameState, playerId, selectedCardIndex, setSelectedCard, selectedTableIndices, clearSelections, isDistributing } = useGameStore();
  const { playCardPlace, playCardHover } = useAmbianceSound();
  const handFlightRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wasDistributing = useRef(isDistributing);
  /** Must be synchronous — `setState` alone does not block a second click in the same frame */
  const playSubmitLockedRef = useRef(false);
  const prevRoundRef = useRef<number | null>(null);
  /** UI mirror of lock (ref does not re-render) */
  const [playPending, setPlayPending] = useState(false);

  const releasePlayLock = useCallback(() => {
    playSubmitLockedRef.current = false;
    setPlayPending(false);
  }, []);

  useEffect(() => {
    if (isDistributing) {
      releasePlayLock();
      return;
    }
    if (!gameState || !playerId) return;

    const rn = gameState.roundNumber;
    if (prevRoundRef.current !== null && rn !== prevRoundRef.current) {
      releasePlayLock();
    }
    prevRoundRef.current = rn;

    if (gameState.currentTurn !== playerId) {
      releasePlayLock();
    }
  }, [gameState?.currentTurn, gameState?.roundNumber, isDistributing, playerId, gameState, releasePlayLock]);

  useEffect(() => {
    const onError = () => releasePlayLock();
    socket.on('error', onError);
    return () => {
      socket.off('error', onError);
    };
  }, [releasePlayLock]);

  useEffect(() => {
    const len = gameState?.hand?.length ?? 0;
    if (wasDistributing.current && !isDistributing && len > 0) {
      requestAnimationFrame(() => {
        const nodes = (gameState?.hand ?? [])
          .map((_, i) => handFlightRefs.current[i])
          .filter(Boolean) as HTMLDivElement[];
        if (nodes.length) {
          gsap.from(nodes, {
            y: -48,
            opacity: 0,
            duration: 0.22,
            stagger: 0.05,
            ease: 'power2.out',
          });
        }
      });
    }
    wasDistributing.current = isDistributing;
  }, [isDistributing, gameState?.hand, gameState?.hand?.length]);

  if (!gameState?.hand || !gameState?.tableCards || !playerId) return null;

  const isMyTurn = gameState.currentTurn === playerId;
  const canConfirm = isMyTurn && selectedCardIndex !== null && !isDistributing;

  const selectedHandCard = selectedCardIndex !== null ? gameState.hand[selectedCardIndex] : null;
  const selectedTableCards = selectedTableIndices
    .filter(i => i >= 0 && i < gameState.tableCards.length)
    .map(i => gameState.tableCards[i]);
  const tableSum = selectedTableCards.reduce((acc, c) => acc + c.value, 0);
  const handCardValue = selectedHandCard?.value ?? 0;
  const isValidCapture = selectedTableIndices.length > 0 && tableSum === handCardValue;
  const isDrop = selectedCardIndex !== null && selectedTableIndices.length === 0;
  const canPlay = canConfirm && (isDrop || isValidCapture);

  const handleCardClick = (index: number) => {
    if (!isMyTurn || isDistributing || playSubmitLockedRef.current) return;
    if (selectedCardIndex === index) {
      setSelectedCard(null);
    } else {
      playCardHover();
      setSelectedCard(index);
    }
  };

  const handleConfirmPlay = () => {
    if (playSubmitLockedRef.current) return;
    if (!canConfirm || selectedCardIndex === null) return;
    if (!canPlay) return;

    playSubmitLockedRef.current = true;
    setPlayPending(true);

    if (selectedTableIndices.length === 0) {
      playCardPlace();
    }

    const idx = selectedCardIndex;
    const tableIdx = [...selectedTableIndices];

    stopCelebrationPlayback();
    socket.emit('play_card', {
      cardIndex: idx,
      tableIndices: tableIdx,
    });
    clearSelections();
  };

  const handSize = gameState.hand.length;

  const getArcStyles = (index: number, total: number) => {
    if (total === 1) return { rotate: 0, y: 0 };

    const maxAngle = Math.min(total * 8, 40);
    const radius = 300;
    const centerIndex = (total - 1) / 2;
    const normalizedPos = centerIndex === 0 ? 0 : (index - centerIndex) / centerIndex;
    const angleDeg = normalizedPos * (maxAngle / 2);
    const angleRad = (angleDeg * Math.PI) / 180;
    const yOffset = (radius - radius * Math.cos(angleRad)) * 1.5;

    return { rotate: angleDeg, y: yOffset };
  };

  const getButtonLabel = () => {
    if (isDrop) return 'Drop';
    if (selectedTableIndices.length > 0) {
      return isValidCapture ? 'Capture' : 'Invalid';
    }
    return 'Play';
  };

  const canClickPlay = canPlay && !playPending;

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2 w-full relative mt-auto">
      <AnimatePresence>
        {isMyTurn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 -inset-y-4 rounded-2xl pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 80%, rgba(212,175,55,0.15) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      <div
        className={`flex justify-center -space-x-6 sm:-space-x-4 relative min-h-[clamp(88px,16vh,180px)] sm:min-h-[140px] md:min-h-[180px] items-end pb-2 sm:pb-4 transition-opacity duration-300 ${
          isMyTurn ? 'opacity-100' : 'opacity-60'
        }`}
      >
        {!isDistributing &&
          gameState.hand.map((card, index) => {
            const isSelected = selectedCardIndex === index;
            const arc = getArcStyles(index, handSize);

            return (
              <div
                key={`${card.rank}-${card.suit}-${index}`}
                className="relative"
                style={{
                  transform: `rotate(${arc.rotate}deg) translateY(${arc.y}px)`,
                  transformOrigin: 'bottom center',
                  zIndex: isSelected ? 10 : index,
                }}
              >
                <div
                  ref={(el) => {
                    handFlightRefs.current[index] = el;
                  }}
                  className={`relative ${isMyTurn ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => handleCardClick(index)}
                  style={{ transformOrigin: 'bottom center' }}
                >
                  <Card card={card} selectable={isMyTurn} selected={isSelected} />
                </div>
              </div>
            );
          })}
      </div>

      {!hidePlayButton && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{
            opacity: isMyTurn ? 1 : 0,
            y: isMyTurn ? 0 : 12,
            scale: 1,
          }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={handleConfirmPlay}
          disabled={!canClickPlay}
          className={`absolute right-0 sm:-right-8 bottom-10 px-3 sm:px-6 py-2 rounded-lg font-ancient font-bold tracking-widest uppercase text-[10px] sm:text-sm transition-all duration-300 min-w-[44px] min-h-[44px] flex items-center justify-center ${
            canClickPlay
              ? 'bg-emerald-600 border-2 border-emerald-400/60 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)] cursor-pointer hover:bg-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.5)]'
              : playPending
                ? 'bg-emerald-800/80 border-2 border-emerald-500/40 text-emerald-100 opacity-90 cursor-wait'
                : selectedTableIndices.length > 0 && !isValidCapture && canConfirm
                  ? 'bg-red-900/60 border-2 border-red-500/40 text-red-300 opacity-70 cursor-not-allowed'
                  : 'bg-wood-dark border-2 border-wood-light text-foreground-muted opacity-40 cursor-not-allowed'
          }`}
        >
          {playPending ? '…' : getButtonLabel()}
        </motion.button>
      )}

      {!isMyTurn && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          className="absolute -bottom-6 text-cream-dark font-ancient italic tracking-wider text-xs sm:text-sm"
        >
          Waiting for opponent...
        </motion.div>
      )}
    </div>
  );
}
