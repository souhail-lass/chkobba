import type { Card as CardType } from '@shared/types.js';
import { Card } from './Card';
import { useGameStore } from '../../stores/useGameStore';
import { useAmbianceSound } from '../../hooks/useAmbianceSound';
import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface TableCardsProps {
  cards: CardType[];
}

export function TableCards({ cards }: TableCardsProps) {
  const { toggleTableCard, selectedTableIndices, gameState, playerId, isDistributing } = useGameStore();
  const { playCardCapture, playCardHover } = useAmbianceSound();
  const isMyTurn = gameState?.currentTurn === playerId;
  const prevCount = useRef(cards.length);
  const cardWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevLenRef = useRef(0);

  useEffect(() => {
    if (cards.length < prevCount.current) {
      playCardCapture();
    }
    prevCount.current = cards.length;
  }, [cards.length, playCardCapture]);

  const handleTableCardClick = (index: number) => {
    if (!isMyTurn || isDistributing) return;
    const willSelect = !selectedTableIndices.includes(index);
    if (willSelect) playCardHover();
    toggleTableCard(index);
  };

  const keySig = cards.map((c) => `${c.rank}-${c.suit}`).join('|');

  /** Animate only newly added cards — full table deal + each new play — not the whole grid on every state tick. */
  useEffect(() => {
    if (cards.length === 0) {
      prevLenRef.current = 0;
      return;
    }

    const prevLen = prevLenRef.current;
    const len = cards.length;

    requestAnimationFrame(() => {
      const targets: HTMLDivElement[] = [];

      if (len > prevLen) {
        for (let i = prevLen; i < len; i++) {
          const n = cardWrapRefs.current[i];
          if (n) targets.push(n);
        }
      }

      prevLenRef.current = len;

      if (!targets.length) return;

      gsap.killTweensOf(targets);

      gsap.fromTo(
        targets,
        { y: -6, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.14,
          stagger: 0.02,
          ease: 'power2.out',
        },
      );
    });
  }, [keySig, cards.length]);

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[var(--card-height)] p-4">
        <span className="text-cream-dark/30 italic text-sm font-ancient">Table is empty</span>
      </div>
    );
  }

  return (
    <div
      className="relative z-40 w-full min-w-0 max-w-full flex items-center justify-center px-2 sm:px-4 py-2 sm:py-4 box-border pointer-events-auto"
      style={{
        minHeight: 'clamp(70px, 12vh, 150px)',
      }}
    >
      <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3 w-full max-w-full min-w-0 mx-auto">
        {cards.map((card, index) => {
          const isSelected = selectedTableIndices.includes(index);
          return (
            <div
              key={`${card.rank}-${card.suit}-${index}`}
              ref={(el) => {
                cardWrapRefs.current[index] = el;
              }}
              className="relative cursor-pointer shrink-0"
              style={{
                transformOrigin: 'center bottom',
                transform: 'translateZ(0)',
              }}
              onClick={() => handleTableCardClick(index)}
            >
              <Card card={card} selected={isSelected} selectable={isMyTurn} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
