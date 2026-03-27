import { useUIStore } from '../../stores/useUIStore';

/**
 * Volume + mute for all game SFX (cards, café props, etc.). Does not affect VintageRadio.
 */
export function SoundEffectsControls() {
  const soundEffectsMuted = useUIStore((s) => s.soundEffectsMuted);
  const soundEffectsVolume = useUIStore((s) => s.soundEffectsVolume);
  const toggleSoundEffects = useUIStore((s) => s.toggleSoundEffects);
  const setSoundEffectsVolume = useUIStore((s) => s.setSoundEffectsVolume);

  const pct = Math.round(soundEffectsVolume * 100);

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-black/40 backdrop-blur-md border border-brass/20 px-2 sm:px-3 py-1 sm:py-1.5 shadow-inner-dark w-full min-w-0"
      role="group"
      aria-label="Game sound effects"
    >
      <label htmlFor="sfx-volume" className="sr-only">
        Game sound effects volume
      </label>
      <input
        id="sfx-volume"
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => setSoundEffectsVolume(Number(e.target.value) / 100)}
        className="flex-1 min-w-0 h-1.5 accent-brass cursor-pointer"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}%`}
      />
      <span className="hidden sm:inline text-[10px] tabular-nums text-cream-dark/60 w-7 shrink-0 text-right" aria-hidden>
        {pct}%
      </span>
      <button
        type="button"
        onClick={toggleSoundEffects}
        className="p-1 sm:p-1.5 min-w-[32px] min-h-[32px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full text-brass hover:bg-black/60 transition-all shrink-0"
        title={soundEffectsMuted ? 'Unmute game sounds' : 'Mute game sounds'}
        aria-label={soundEffectsMuted ? 'Unmute game sound effects' : 'Mute game sound effects'}
        aria-pressed={soundEffectsMuted}
      >
        {soundEffectsMuted ? (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>
    </div>
  );
}
