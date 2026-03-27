import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../../lib/socket';
import { EMOTE_LIST, EMOTE_COOLDOWN_MS, getEmoteById } from '../../lib/emoteCatalog';
import type { EmoteId } from '../../lib/emoteCatalog';
import { playAssetSoundMp3 } from '../../lib/playAssetSound';
import { useUIStore } from '../../stores/useUIStore';
import { DEFAULT_CHKOBBA_SFX_EMOTE_ID, DEFAULT_HAYYA_SFX_EMOTE_ID } from '../../lib/sfxEmoteDefaults';

/** Single row in the Haya / Chkobba scroll lists — icons only (defaults picker). */
function CelebrationPickRow({
  e,
  selected,
  variant,
  onPick,
}: {
  e: (typeof EMOTE_LIST)[number];
  selected: boolean;
  variant: 'haya' | 'chkobba';
  onPick: () => void;
}) {
  const sel =
    variant === 'haya'
      ? 'border-orange-400/50 bg-orange-950/25 ring-1 ring-orange-400/35'
      : 'border-brass bg-brass/15 ring-1 ring-brass/45';

  return (
    <button
      type="button"
      onClick={onPick}
      title={e.label}
      aria-label={`${variant === 'haya' ? 'Haya' : 'Chkobba'} default: ${e.label}`}
      aria-pressed={selected}
      className={`flex w-full items-center justify-center rounded-md border px-1 py-2 transition-colors min-h-[2.5rem] ${
        selected ? sel : 'border-[#b8942f]/15 bg-black/20 hover:bg-[#1a3d2b]/60 hover:border-[#b8942f]/35'
      }`}
    >
      <span className="text-xl leading-none" aria-hidden>
        {e.icon}
      </span>
    </button>
  );
}

/**
 * Sound emotes + two scrollable default slots (7 Haya / Chkobba fanfare).
 * Celebration columns: icon-only. Main grid: icon + label together.
 */
export function EmotePanel({
  alignPopoverRight = false,
  embedded = false,
}: {
  alignPopoverRight?: boolean;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lastEmitAt = useRef(0);

  const sfxChkobbaId = useUIStore((s) => s.sfxCelebrationChkobbaEmoteId);
  const sfxHayyaId = useUIStore((s) => s.sfxCelebrationHayyaEmoteId);
  const setSfxChkobba = useUIStore((s) => s.setSfxCelebrationChkobbaEmoteId);
  const setSfxHayya = useUIStore((s) => s.setSfxCelebrationHayyaEmoteId);

  const send = useCallback((id: EmoteId) => {
    const meta = getEmoteById(id);
    if (meta) playAssetSoundMp3(meta.file, 'emote:local');

    const now = Date.now();
    if (now - lastEmitAt.current >= EMOTE_COOLDOWN_MS) {
      lastEmitAt.current = now;
      socket.emit('game_emote', { emoteId: id });
    }
    setOpen(false);
  }, []);

  const panel = (
    <motion.div
      initial={embedded ? false : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={embedded ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
      transition={embedded ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
      className={
        embedded
          ? 'w-full max-h-[min(58vh,540px)] overflow-y-auto rounded-xl border-2 border-[#b8942f]/60 bg-[#0f2419]/98 shadow-[0_12px_40px_rgba(0,0,0,0.55)] p-2'
          : `absolute bottom-full mb-2 w-[min(20rem,calc(100vw-8rem))] sm:w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(70vh,560px)] overflow-y-auto rounded-xl border-2 border-[#b8942f]/60 bg-[#0f2419]/98 shadow-[0_12px_40px_rgba(0,0,0,0.55)] p-2 z-[220] ${alignPopoverRight ? 'right-0 left-auto' : 'left-0 right-auto'}`
      }
      role="dialog"
      aria-label="Sound emotes"
    >
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="min-w-0 flex flex-col">
          <div className="mb-1 text-center">
            <div className="text-[9px] font-ancient uppercase tracking-[0.28em] text-orange-300/90">7 Haya</div>
            <div className="text-[8px] text-cream/40 font-ancient mt-0.5">
              Default:{' '}
              {getEmoteById(sfxHayyaId)?.label ?? getEmoteById(DEFAULT_HAYYA_SFX_EMOTE_ID)?.label ?? '—'}
            </div>
          </div>
          <div
            className="h-[9.5rem] overflow-y-auto rounded-lg border border-orange-500/25 bg-black/30 hide-scrollbar scroll-smooth touch-pan-y"
            role="listbox"
            aria-label="Default Haya celebration sound"
          >
            <div className="flex flex-col gap-1 p-1">
              {EMOTE_LIST.map((e) => (
                <CelebrationPickRow
                  key={`h-${e.id}`}
                  e={e}
                  variant="haya"
                  selected={sfxHayyaId === e.id}
                  onPick={() => setSfxHayya(e.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="mb-1 text-center">
            <div className="text-[9px] font-ancient uppercase tracking-[0.28em] text-[#d4af37]/90">Chkobba</div>
            <div className="text-[8px] text-cream/40 font-ancient mt-0.5">
              Default:{' '}
              {getEmoteById(sfxChkobbaId)?.label ?? getEmoteById(DEFAULT_CHKOBBA_SFX_EMOTE_ID)?.label ?? '—'}
            </div>
          </div>
          <div
            className="h-[9.5rem] overflow-y-auto rounded-lg border border-[#b8942f]/30 bg-black/30 hide-scrollbar scroll-smooth touch-pan-y"
            role="listbox"
            aria-label="Default Chkobba celebration sound"
          >
            <div className="flex flex-col gap-1 p-1">
              {EMOTE_LIST.map((e) => (
                <CelebrationPickRow
                  key={`c-${e.id}`}
                  e={e}
                  variant="chkobba"
                  selected={sfxChkobbaId === e.id}
                  onPick={() => setSfxChkobba(e.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#b8942f]/20 pt-2">
        <div className="text-[8px] font-ancient uppercase tracking-widest text-cream/45 text-center mb-1.5">
          Table emotes
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {EMOTE_LIST.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => send(e.id)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[#b8942f]/25 bg-black/35 px-0.5 py-1.5 hover:bg-[#1a3d2b]/90 hover:border-brass/50 transition-colors min-h-[3.75rem]"
              title={e.label}
              aria-label={e.label}
            >
              <span className="text-lg sm:text-xl leading-none" aria-hidden>
                {e.icon}
              </span>
              <span className="text-[7px] font-ancient text-cream/80 text-center leading-tight px-0.5 line-clamp-2">
                {e.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );

  if (embedded) {
    return <div className="w-full pointer-events-auto">{panel}</div>;
  }

  return (
    <div className="relative shrink-0 pointer-events-auto">
      <AnimatePresence>
        {open && panel}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="relative flex h-[36px] min-h-[36px] w-[36px] sm:h-[41px] sm:min-h-[41px] sm:w-[41px] shrink-0 items-center justify-center rounded-t-xl rounded-b-sm bg-[#1a3d2b] border-2 border-[#b8942f] text-cream/90 hover:text-white hover:bg-[#142f22] shadow-lg transition-all cursor-pointer box-border"
        title="Sound emotes — table + default fanfares"
        aria-label="Open sound emotes"
      >
        <span className="text-[15px] sm:text-[17px] leading-none" aria-hidden>
          🔊
        </span>
      </button>
    </div>
  );
}
