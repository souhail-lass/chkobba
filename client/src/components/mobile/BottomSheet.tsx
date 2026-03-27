import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxHeight?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  maxHeight = '70vh',
}: BottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 z-[150]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-[160] rounded-t-2xl bg-[#0f1a0e] border-t border-brass/20 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
            style={{ maxHeight }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />

            {title && (
              <h2 className="text-brass font-ancient uppercase tracking-[0.3em] text-sm font-black text-center mb-4 opacity-80">
                {title}
              </h2>
            )}

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
