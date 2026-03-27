import { useGameStore } from '../../stores/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { generateCardSVG } from '../../lib/cardUtils';
import { getAvatarUrl } from '../../utils/avatar';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useUIStore } from '../../stores/useUIStore';
import { socket } from '../../lib/socket';

function CardIcon({ rank, suit, className }: { rank: string; suit: string; className?: string }) {
  const svg = generateCardSVG(rank, suit);
  return (
    <div
      className={`w-7 h-10 sm:w-9 sm:h-13 rounded-sm overflow-hidden shadow-glow-brass/20 border border-white/10 bg-white/5 transition-transform ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    if (value !== displayValue) {
      previousValue.current = displayValue;
      setDisplayValue(value);
    }
  }, [value, displayValue]);

  const isIncrementing = value > previousValue.current;

  return (
    <div className={`relative inline-flex overflow-hidden ${className}`} style={{ height: '1.2em' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={displayValue}
          initial={{ y: isIncrementing ? 40 : -40, opacity: 0, filter: 'brightness(2)' }}
          animate={{ y: 0, opacity: 1, filter: 'brightness(1)' }}
          exit={{ y: isIncrementing ? -40 : 40, opacity: 0, filter: 'brightness(0.5)' }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute inset-0 flex items-center justify-center leading-none"
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
      {/* Invisible spacer to maintain layout width based on current digit length */}
      <span className="invisible pointer-events-none flex items-center justify-center leading-none">
        {displayValue}
      </span>
    </div>
  );
}

function PointIndicator({ my, opp, active }: { my: number; opp: number; active?: boolean }) {
  if (my > opp) return (
    <motion.div animate={active ? { scale: [1, 1.2, 1] } : {}} className="flex items-center gap-1">
      <span className="text-accent text-[10px] font-bold font-ancient shadow-glow-accent">+1 PT</span>
    </motion.div>
  );
  if (opp > my) return (
    <div className="flex items-center gap-1">
      <span className="text-turquoise text-[10px] font-bold font-ancient shadow-glow-turquoise">+1 PT</span>
    </div>
  );
  return <span className="text-white/10 text-[10px] font-ancient">—</span>;
}

function StatRow({ label, myVal, oppVal, icon, pointMy, pointOpp }: any) {
  const isLeading = pointMy > pointOpp;
  const isLosing = pointOpp > pointMy;

  return (
    <div className={`flex items-center justify-between py-4 border-b border-white/5 last:border-0 relative transition-all duration-500 px-3 rounded-xl mb-1 ${
      isLeading ? 'bg-accent/10 shadow-[inset_0_0_20px_rgba(192,57,43,0.1)]' :
      isLosing ? 'bg-turquoise/10 shadow-[inset_0_0_20px_rgba(64,224,208,0.1)]' :
      'bg-white/5'
    }`}>
      {/* My Team Column */}
      <div className="w-16 flex flex-col items-end">
        <AnimatedNumber
          value={myVal}
          className={`font-ancient font-extrabold text-2xl sm:text-3xl ${isLeading ? 'text-accent drop-shadow-glow-red' : 'text-cream/40'}`}
        />
        {pointMy > pointOpp && (
          <span className="text-[8px] font-bold text-accent uppercase tracking-tighter">+1 POINT</span>
        )}
      </div>

      {/* Center Label/Icon Column */}
      <div className="flex flex-col items-center flex-1 px-4">
        {icon && (
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="mb-3 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] z-10"
          >
            {icon}
          </motion.div>
        )}
        <span className="text-[10px] sm:text-[11px] text-cream/60 font-ancient uppercase tracking-[0.3em] font-extrabold text-center leading-none">
          {label}
        </span>
      </div>

      {/* Opponent Column */}
      <div className="w-16 flex flex-col items-start">
        <AnimatedNumber
          value={oppVal}
          className={`font-ancient font-extrabold text-2xl sm:text-3xl ${isLosing ? 'text-turquoise drop-shadow-glow-turquoise' : 'text-cream/40'}`}
        />
        {oppVal > myVal && (
          <span className="text-[8px] font-bold text-turquoise uppercase tracking-tighter">+1 POINT</span>
        )}
      </div>
    </div>
  );
}

export function Scoreboard() {
  const gameState = useGameStore((s) => s.gameState);
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const storeIsHost = useGameStore((s) => s.isHost);
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!gameState || !playerId) return null;

  const currentPlayer = gameState.players.find((p) => p.id === playerId);
  if (!currentPlayer) return null;

  // Use either the store flag or the room's direct hostId for robustness
  const isHost = storeIsHost || (room?.hostId === playerId);

  const myTeam = currentPlayer.team;
  const myScore = myTeam === 0 ? gameState.scores.team0 : gameState.scores.team1;
  const oppScore = myTeam === 0 ? gameState.scores.team1 : gameState.scores.team0;

  const oppPlayer = gameState.players.find((p) => p.team !== myTeam);
  const myNickname = currentPlayer.nickname;
  const oppNickname = oppPlayer ? oppPlayer.nickname : 'Opponent';

  const myTeamPlayers = gameState.players.filter(p => p.team === myTeam);
  const oppTeamPlayers = gameState.players.filter(p => p.team !== myTeam);

  const myCards = myTeamPlayers.reduce((s, p) => s + p.capturedCount, 0);
  const oppCards = oppTeamPlayers.reduce((s, p) => s + p.capturedCount, 0);
  const myChkobba = myTeamPlayers.reduce((s, p) => s + p.chkobbaCount, 0);
  const oppChkobba = oppTeamPlayers.reduce((s, p) => s + p.chkobbaCount, 0);
  const myDinari = myTeamPlayers.reduce((s, p) => s + p.dinariCount, 0);
  const oppDinari = oppTeamPlayers.reduce((s, p) => s + p.dinariCount, 0);
  const mySevens = myTeamPlayers.reduce((s, p) => s + p.sevensCount, 0);
  const oppSevens = oppTeamPlayers.reduce((s, p) => s + p.sevensCount, 0);
  const myHasHaya = myTeamPlayers.some(p => p.hasHaya);
  const oppHasHaya = oppTeamPlayers.some(p => p.hasHaya);

  const myRoundScore = myTeam === 0 ? gameState.roundScores.team0 : gameState.roundScores.team1;
  const oppRoundScore = myTeam === 0 ? gameState.roundScores.team1 : gameState.roundScores.team0;

  const handleReturnToLobby = () => {
    socket.emit('reset_game');
  };

  const renderStatsContent = () => (
    <div className="bg-black/40 rounded-3xl border border-white/5 p-4 sm:p-6 shadow-inner-dark relative overflow-hidden backdrop-blur-md">
      <div className="space-y-1">
        <StatRow label="CARTA" myVal={myCards} oppVal={oppCards} pointMy={myCards} pointOpp={oppCards} />

        <StatRow
          label="DINARI"
          myVal={myDinari}
          oppVal={oppDinari}
          pointMy={myDinari}
          pointOpp={oppDinari}
          icon={<CardIcon rank="A" suit="diamonds" className="rotate-[-4deg] scale-110 shadow-glow-gold" />}
        />

        <StatRow
          label="BERMILA"
          myVal={mySevens}
          oppVal={oppSevens}
          pointMy={mySevens}
          pointOpp={oppSevens}
          icon={
            <div className="flex -space-x-5">
              <CardIcon rank="7" suit="spades" className="rotate-[-12deg] -translate-x-1" />
              <CardIcon rank="7" suit="hearts" className="rotate-[12deg] translate-x-1" />
            </div>
          }
        />

        <StatRow
          label="7 HAYA"
          myVal={myHasHaya ? 1 : 0}
          oppVal={oppHasHaya ? 1 : 0}
          pointMy={myHasHaya ? 1 : 0}
          pointOpp={oppHasHaya ? 1 : 0}
          icon={<CardIcon rank="7" suit="diamonds" className="ring-2 ring-accent shadow-[0_0_20px_rgba(192,57,43,0.6)] scale-125 z-20" />}
        />

        <StatRow label="CHKOBBA" myVal={myChkobba} oppVal={oppChkobba} pointMy={myChkobba} pointOpp={oppChkobba} />
      </div>

      <div className="mt-8 pt-6 border-t border-brass/20 flex flex-col gap-3">
        {isHost && (
          <Button 
            variant="primary" 
            onClick={handleReturnToLobby}
            className="w-full py-4 text-xs tracking-[0.2em] shadow-glow-gold/10"
          >
            End Match & Edit Rules
          </Button>
        )}

        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-center">
            <div className="text-[9px] text-accent/60 font-ancient font-bold uppercase tracking-widest mb-1">Round</div>
            <AnimatedNumber value={myRoundScore} className="text-3xl font-ancient font-extrabold text-accent" />
          </div>

          <div className="bg-black/60 px-5 py-2 rounded-xl border border-brass/20 shadow-glow-gold/5">
            <span className="text-[10px] text-brass-light font-ancient font-black uppercase tracking-[0.4em]">TOTAL PTS</span>
          </div>

          <div className="text-center">
            <div className="text-[9px] text-turquoise/60 font-ancient font-bold uppercase tracking-widest mb-1">Round</div>
            <AnimatedNumber value={oppRoundScore} className="text-3xl font-ancient font-extrabold text-turquoise" />
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            socket.emit('leave_room');
            useUIStore.getState().setIsSubmitting(false);
            useUIStore.getState().setScreen('landing');
            sessionStorage.removeItem('chkobba-storage');
            setTimeout(() => {
              useGameStore.getState().reset();
            }, 100);
          }}
          className="w-full flex flex-col items-center justify-center py-4 rounded-xl border min-h-[44px] border-red-500/25 bg-red-500/[0.07] hover:bg-red-500/15 hover:border-red-500/40 transition-colors"
        >
          <span className="text-[11px] font-ancient uppercase tracking-[0.3em] font-black text-red-400/95">
            Leave Game
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))] z-[45] max-w-[min(calc(100vw-5.5rem),22rem)] max-[height:920px]:origin-top-right max-[height:920px]:scale-[0.92] max-[height:780px]:scale-[0.88]"
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="glass-panel-heavy rounded-3xl shadow-2xl cursor-pointer select-none overflow-hidden premium-border-brass min-w-[220px] sm:min-w-[280px]"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="px-6 py-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 relative overflow-hidden">
          {/* Active Lead Glow */}
          <div className={`absolute inset-0 opacity-10 pointer-events-none ${
            myScore > oppScore ? 'bg-accent animate-pulse' :
            oppScore > myScore ? 'bg-turquoise animate-pulse' : ''
          }`} />

          <div className="flex flex-col items-center text-center relative z-10 gap-1">
            <img
              src={getAvatarUrl(myNickname)}
              alt=""
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 shadow-lg shrink-0 ${
                myScore >= oppScore ? 'border-accent/70 ring-1 ring-accent/30' : 'border-white/15'
              }`}
            />
            <span
              className={`text-[10px] sm:text-[11px] font-ancient uppercase font-black tracking-widest truncate w-full max-w-[min(7.5rem,42vw)] ${
                myScore >= oppScore ? 'text-accent' : 'text-cream/40'
              }`}
              title={myNickname}
            >
              {myNickname}
            </span>
            <AnimatedNumber
              value={myScore}
              className={`text-4xl sm:text-5xl font-ancient font-black ${
                myScore > oppScore ? 'text-accent drop-shadow-glow-red' :
                myScore === oppScore ? 'text-brass-light' : 'text-accent/40'
              }`}
            />
          </div>

          <div className="flex flex-col items-center justify-center relative z-10">
            <div className="text-[10px] text-brass font-black mb-1 opacity-40">VS</div>
            <div className="px-3 py-1 rounded-lg bg-black/60 border border-brass/30 shadow-inner">
              <span className="text-[9px] text-brass-light font-ancient font-black uppercase tracking-[0.2em] whitespace-nowrap">
                RD {gameState.roundNumber}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center text-center relative z-10 gap-1">
            <img
              src={getAvatarUrl(oppNickname)}
              alt=""
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 shadow-lg shrink-0 ${
                oppScore >= myScore ? 'border-turquoise/70 ring-1 ring-turquoise/30' : 'border-white/15'
              }`}
            />
            <span
              className={`text-[10px] sm:text-[11px] font-ancient uppercase font-black tracking-widest truncate w-full max-w-[min(7.5rem,42vw)] ${
                oppScore >= myScore ? 'text-turquoise' : 'text-cream/40'
              }`}
              title={oppNickname}
            >
              {oppNickname}
            </span>
            <AnimatedNumber
              value={oppScore}
              className={`text-4xl sm:text-5xl font-ancient font-black ${
                oppScore > myScore ? 'text-turquoise drop-shadow-glow-turquoise' :
                oppScore === myScore ? 'text-brass-light' : 'text-turquoise/40'
              }`}
            />
          </div>
        </div>

        {!isMobile && (
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden bg-black/20"
              >
                <div className="p-6 border-t border-white/5">
                  <div className="text-[11px] text-brass font-ancient uppercase tracking-[0.5em] text-center mb-8 font-black opacity-60">
                    LIVE STATS
                  </div>
                  {renderStatsContent()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.div>

      {isMobile && (
        <Modal isOpen={expanded} onClose={() => setExpanded(false)}>
          <div className="flex flex-col items-center">
            <div className="w-full flex flex-col items-center mb-8 border-b border-white/10 pb-6">
              <h2 className="text-brass-light font-ancient uppercase tracking-[0.4em] text-2xl font-black mb-2">
                Match Progress
              </h2>
              <div className="w-12 h-1 bg-brass/30 rounded-full" />
            </div>
            <div className="w-full px-1 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {renderStatsContent()}
            </div>
            <div className="mt-8 w-full">
              <Button variant="secondary" onClick={() => setExpanded(false)} className="w-full py-5 text-lg">Close Dashboard</Button>
            </div>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}