import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useChatStore } from '../../stores/useChatStore';
import { socket } from '../../lib/socket';
import { stopCelebrationPlayback } from '../../lib/playAssetSound';
import { SoundEffectsControls } from '../game/SoundEffectsControls';
import { EmotePanel } from '../game/EmotePanel';
import { BottomSheet } from './BottomSheet';

interface MobileActionBarProps {
  roomId: string;
  onCopyCode: () => void;
  copied: boolean;
}

export function MobileActionBar({ roomId, onCopyCode, copied }: MobileActionBarProps) {
  const {
    selectedCardIndex,
    selectedTableIndices,
    gameState,
    playerId,
    isDistributing,
    clearSelections,
  } = useGameStore();

  const [sfxSheetOpen, setSfxSheetOpen] = useState(false);
  const playSubmitLockedRef = useRef(false);
  const [playPending, setPlayPending] = useState(false);
  const prevRoundRef = useRef<number | null>(null);

  const releasePlayLock = useCallback(() => {
    playSubmitLockedRef.current = false;
    setPlayPending(false);
  }, []);

  // Lock-release pattern matching PlayerHand.tsx
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

  const isMyTurn = gameState?.currentTurn === playerId;
  const canConfirm = isMyTurn && selectedCardIndex !== null && !isDistributing;

  const selectedHandCard = selectedCardIndex !== null && gameState?.hand ? gameState.hand[selectedCardIndex] : null;
  const selectedTableCards = (selectedTableIndices ?? [])
    .filter(i => i >= 0 && gameState && i < gameState.tableCards.length)
    .map(i => gameState!.tableCards[i]);
  const tableSum = selectedTableCards.reduce((acc, c) => acc + c.value, 0);
  const handCardValue = selectedHandCard?.value ?? 0;
  const isValidCapture = selectedTableIndices.length > 0 && tableSum === handCardValue;
  const isDrop = selectedCardIndex !== null && selectedTableIndices.length === 0;
  const canPlay = canConfirm && (isDrop || isValidCapture);

  const handlePlay = () => {
    if (playSubmitLockedRef.current) return;
    if (!canConfirm || selectedCardIndex === null) return;
    if (!canPlay) return;

    playSubmitLockedRef.current = true;
    setPlayPending(true);

    if (selectedTableIndices.length === 0) {
      // Drop - no capture sound
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

  const getButtonLabel = () => {
    if (isDrop) return 'DROP';
    if (selectedTableIndices.length > 0) {
      return isValidCapture ? 'CAPTURE' : 'INVALID';
    }
    return 'PLAY';
  };

  const canClickPlay = canPlay && !playPending;
  const unreadCount = useChatStore((s) => s.unreadCount);
  const toggleChat = useChatStore((s) => s.toggleChat);

  return (
    <>
      <div className="h-14 flex items-center px-2 gap-1 bg-black/85 backdrop-blur-xl border-t border-brass/20 pb-[env(safe-area-inset-bottom)] w-full">
        {/* PLAY button */}
        <button
          type="button"
          onClick={handlePlay}
          disabled={!canClickPlay}
          className={`flex-1 flex items-center justify-center rounded-lg font-ancient font-bold tracking-widest uppercase text-[9px] min-h-[44px] transition-all ${
            canClickPlay
              ? 'bg-emerald-600 border-2 border-emerald-400/60 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)] active:bg-emerald-500'
              : playPending
                ? 'bg-emerald-800/80 border-2 border-emerald-500/40 text-emerald-100 opacity-90'
                : selectedTableIndices.length > 0 && !isValidCapture && canConfirm
                  ? 'bg-red-900/60 border-2 border-red-500/40 text-red-300 opacity-70'
                  : 'bg-wood-dark border-2 border-wood-light text-foreground-muted opacity-40'
          }`}
        >
          {playPending ? '...' : getButtonLabel()}
        </button>

        {/* CHAT button */}
        <button
          type="button"
          onClick={toggleChat}
          className="flex-1 relative flex items-center justify-center rounded-lg bg-[#1a3d2b] border-2 border-[#b8942f]/60 text-cream/90 hover:text-white hover:bg-[#142f22] transition-colors min-h-[44px]"
        >
          <span className="font-ancient font-bold uppercase tracking-wider text-[9px]">CHAT</span>
          {unreadCount > 0 && !useChatStore.getState().isOpen && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border border-[#1a3d2b]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* SFX/EMOTES button */}
        <button
          type="button"
          onClick={() => setSfxSheetOpen(true)}
          className="flex-1 flex items-center justify-center rounded-lg bg-[#1a3d2b] border-2 border-[#b8942f]/60 text-cream/90 hover:text-white hover:bg-[#142f22] transition-colors min-h-[44px]"
        >
          <span className="text-[15px] leading-none" aria-hidden>🔊</span>
        </button>

        {/* ROOM code button */}
        <button
          type="button"
          onClick={onCopyCode}
          className="flex-1 flex flex-col items-center justify-center rounded-lg bg-black/40 border border-brass/20 min-h-[44px] relative"
        >
          {copied && (
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-brass text-black text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
              Copied!
            </span>
          )}
          <span className="text-[8px] text-brass/60 font-ancient uppercase tracking-wider">Room</span>
          <span className="text-[9px] text-brass font-mono font-bold tracking-wider truncate max-w-[60px]">
            {roomId}
          </span>
        </button>
      </div>

      {/* SFX/Emotes BottomSheet */}
      <BottomSheet
        isOpen={sfxSheetOpen}
        onClose={() => setSfxSheetOpen(false)}
        title="Sound & Emotes"
        maxHeight="75vh"
      >
        <div className="space-y-4 pb-4">
          <div>
            <div className="text-[9px] font-ancient uppercase tracking-widest text-cream/50 mb-2">Sound Effects</div>
            <SoundEffectsControls />
          </div>
          <div>
            <div className="text-[9px] font-ancient uppercase tracking-widest text-cream/50 mb-2">Emotes</div>
            <EmotePanel embedded />
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
