import { create } from 'zustand';
import { isValidGameEmoteId } from '@shared/emotes';
import {
  DEFAULT_CHKOBBA_SFX_EMOTE_ID,
  DEFAULT_HAYYA_SFX_EMOTE_ID,
  normalizeChkobbaSfxEmoteId,
  normalizeHayyaSfxEmoteId,
} from '../lib/sfxEmoteDefaults';

export type Screen = 'landing' | 'howToPlay' | 'createRoom' | 'joinRoom' | 'lobby' | 'game';
export type ToastType = 'info' | 'success' | 'error';
export type WaitressStatus = 'idle' | 'serving';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

const LS_SFX_CHK = 'chkobba-sfx-celebration-chkobba-emote';
const LS_SFX_HAY = 'chkobba-sfx-celebration-hayya-emote';

function loadStoredEmoteId(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (raw && isValidGameEmoteId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

interface UIStore {
  screen: Screen;
  showAmbiance: boolean;
  /** 0–1; multiplied with all SFX (cards, café props, etc.). Radio is separate. */
  soundEffectsVolume: number;
  soundEffectsMuted: boolean;
  /** Sound emote id played when you (locally) celebrate a Chkobba — persisted in localStorage. */
  sfxCelebrationChkobbaEmoteId: string;
  /** Sound emote id for 7 Haya — persisted in localStorage. */
  sfxCelebrationHayyaEmoteId: string;
  toasts: ToastMessage[];
  waitressStatus: WaitressStatus;
  isWaitressVisible: boolean;
  isSubmitting: boolean;
  setScreen: (screen: Screen) => void;
  toggleAmbiance: () => void;
  setSoundEffectsVolume: (volume: number) => void;
  toggleSoundEffects: () => void;
  setSfxCelebrationChkobbaEmoteId: (id: string) => void;
  setSfxCelebrationHayyaEmoteId: (id: string) => void;
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  setWaitressStatus: (status: WaitressStatus) => void;
  setWaitressVisible: (visible: boolean) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
}

// Check if we have a persisted session immediately on load
const getInitialScreen = (): Screen => {
  try {
    // Use sessionStorage so multiple tabs on localhost have independent sessions
    const raw = sessionStorage.getItem('chkobba-storage');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.state && data.state.roomId && data.state.playerId) {
        // If we have a session, start in 'lobby' as a loading state
        return 'lobby'; 
      }
    }
  } catch (e) {}
  try {
    const path = window.location?.pathname || '/';
    if (path === '/how-to-play' || path === '/how-to-play/') return 'howToPlay';
  } catch {
    /* ignore */
  }
  return 'landing';
};

export const useUIStore = create<UIStore>((set) => ({
  screen: getInitialScreen(),
  showAmbiance: true,
  soundEffectsVolume: 1,
  soundEffectsMuted: false,
  sfxCelebrationChkobbaEmoteId: normalizeChkobbaSfxEmoteId(loadStoredEmoteId(LS_SFX_CHK, DEFAULT_CHKOBBA_SFX_EMOTE_ID)),
  sfxCelebrationHayyaEmoteId: normalizeHayyaSfxEmoteId(loadStoredEmoteId(LS_SFX_HAY, DEFAULT_HAYYA_SFX_EMOTE_ID)),
  toasts: [],
  waitressStatus: 'idle',
  isWaitressVisible: false,
  isSubmitting: false,

  setScreen: (screen) => set({ screen }),
  toggleAmbiance: () => set((state) => ({ showAmbiance: !state.showAmbiance })),
  setSoundEffectsVolume: (volume) =>
    set({
      soundEffectsVolume: Math.max(0, Math.min(1, volume)),
    }),
  toggleSoundEffects: () => set((state) => ({ soundEffectsMuted: !state.soundEffectsMuted })),

  setSfxCelebrationChkobbaEmoteId: (id) => {
    const next = normalizeChkobbaSfxEmoteId(id);
    try {
      localStorage.setItem(LS_SFX_CHK, next);
    } catch {
      /* ignore */
    }
    set({ sfxCelebrationChkobbaEmoteId: next });
  },
  setSfxCelebrationHayyaEmoteId: (id) => {
    const next = normalizeHayyaSfxEmoteId(id);
    try {
      localStorage.setItem(LS_SFX_HAY, next);
    } catch {
      /* ignore */
    }
    set({ sfxCelebrationHayyaEmoteId: next });
  },

  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setWaitressStatus: (waitressStatus) => set({ waitressStatus }),
  setWaitressVisible: (isWaitressVisible) => set({ isWaitressVisible }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
}));
