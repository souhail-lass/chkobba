import { motion } from 'framer-motion';
import { ChkobbaRulesContent } from './ChkobbaRulesContent';
import { useUIStore } from '../../stores/useUIStore';

export function HowToPlayScreen() {
  const setScreen = useUIStore((s) => s.setScreen);

  const goHome = () => {
    try {
      window.history.pushState({}, '', '/');
    } catch {
      /* ignore */
    }
    setScreen('landing');
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] relative overflow-x-hidden overflow-y-auto bg-transparent flex flex-col"
      aria-labelledby="how-to-play-title"
    >
      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <button
          type="button"
          onClick={goHome}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 backdrop-blur px-4 py-2 text-xs sm:text-sm font-ancient text-cream/75 hover:text-brass/90 hover:border-brass/20 transition-colors"
        >
          <span aria-hidden>←</span>
          Accueil
        </button>

        <header className="mb-8 sm:mb-10">
          <h1
            id="how-to-play-title"
            className="text-[clamp(2rem,7vw,3.5rem)] font-black leading-[1.02] tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#f5e6a8] via-brass to-[#a67c1a] drop-shadow-[0_2px_22px_rgba(212,175,55,0.14)]"
          >
            Comment jouer à la Chkobba (Chkobba)
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-cream/70 font-ancient leading-relaxed tracking-wide">
            Règles authentiques de la chkobba tunisienne, expliquées simplement. Vous pouvez jouer en ligne sur mobile ou ordinateur,
            puis revenir à la table pour créer une salle et inviter vos amis.
          </p>
        </header>

        <div className="rounded-[1.75rem] border border-white/[0.08] bg-black/25 backdrop-blur-xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6 sm:p-8">
          <ChkobbaRulesContent />
        </div>
      </div>
    </motion.section>
  );
}

