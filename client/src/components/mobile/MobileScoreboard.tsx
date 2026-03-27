import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';
import { socket } from '../../lib/socket';
import { getAvatarUrl } from '../../utils/avatar';
import { Button } from '../ui/Button';
import { BottomSheet } from './BottomSheet';

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className}>{value}</span>
  );
}

function StatRow({ label, myVal, oppVal }: { label: string; myVal: number; oppVal: number }) {
  const leading = myVal > oppVal;
  const losing = oppVal > myVal;
  return (
    <div className={`flex items-center justify-between py-3 border-b border-white/5 last:border-0 px-2 rounded-lg mb-1 ${
      leading ? 'bg-accent/10' : losing ? 'bg-turquoise/10' : 'bg-white/5'
    }`}>
      <div className="w-12 text-right">
        <span className={`font-ancient font-extrabold text-xl ${leading ? 'text-accent' : 'text-cream/40'}`}>
          {myVal}
        </span>
        {leading && <div className="text-[7px] font-bold text-accent uppercase tracking-tighter">+1 PT</div>}
      </div>
      <span className="flex-1 text-center text-[10px] text-cream/60 font-ancient uppercase tracking-[0.3em] font-extrabold">
        {label}
      </span>
      <div className="w-12 text-left">
        <span className={`font-ancient font-extrabold text-xl ${losing ? 'text-turquoise' : 'text-cream/40'}`}>
          {oppVal}
        </span>
        {losing && <div className="text-[7px] font-bold text-turquoise uppercase tracking-tighter">+1 PT</div>}
      </div>
    </div>
  );
}

export function MobileScoreboard() {
  const gameState = useGameStore((s) => s.gameState);
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const storeIsHost = useGameStore((s) => s.isHost);
  const [expanded, setExpanded] = useState(false);

  if (!gameState || !playerId) return null;

  const currentPlayer = gameState.players.find((p) => p.id === playerId);
  if (!currentPlayer) return null;

  const isHost = storeIsHost || (room?.hostId === playerId);
  const myTeam = currentPlayer.team;
  const myScore = myTeam === 0 ? gameState.scores.team0 : gameState.scores.team1;
  const oppScore = myTeam === 0 ? gameState.scores.team1 : gameState.scores.team0;
  const oppPlayer = gameState.players.find((p) => p.team !== myTeam);
  const myNickname = currentPlayer.nickname;
  const oppNickname = oppPlayer?.nickname ?? 'Opponent';

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

  return (
    <>
      {/* Compact bar */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="h-full w-full flex items-center px-3 gap-2 bg-black/50 backdrop-blur-sm active:bg-black/70 transition-colors"
        aria-label="Open match stats"
      >
        {/* My side */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <img
            src={getAvatarUrl(myNickname)}
            alt=""
            className={`w-6 h-6 rounded-full object-cover border shrink-0 ${
              myScore >= oppScore ? 'border-accent/60' : 'border-white/15'
            }`}
          />
          <span className={`text-[10px] font-ancient uppercase font-black tracking-wider truncate ${
            myScore >= oppScore ? 'text-accent' : 'text-cream/40'
          }`}>
            {myNickname}
          </span>
          <AnimatedNumber
            value={myScore}
            className={`text-xl font-ancient font-black ml-auto shrink-0 ${
              myScore > oppScore ? 'text-accent' : myScore === oppScore ? 'text-brass-light' : 'text-accent/40'
            }`}
          />
        </div>

        {/* VS + Round */}
        <div className="flex flex-col items-center shrink-0 px-1">
          <span className="text-[7px] text-brass/40 font-black uppercase">VS</span>
          <span className="text-[8px] text-brass font-ancient font-black uppercase tracking-widest whitespace-nowrap">
            RD {gameState.roundNumber}
          </span>
        </div>

        {/* Opp side */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-row-reverse">
          <img
            src={getAvatarUrl(oppNickname)}
            alt=""
            className={`w-6 h-6 rounded-full object-cover border shrink-0 ${
              oppScore >= myScore ? 'border-turquoise/60' : 'border-white/15'
            }`}
          />
          <span className={`text-[10px] font-ancient uppercase font-black tracking-wider truncate text-right ${
            oppScore >= myScore ? 'text-turquoise' : 'text-cream/40'
          }`}>
            {oppNickname}
          </span>
          <AnimatedNumber
            value={oppScore}
            className={`text-xl font-ancient font-black mr-auto shrink-0 ${
              oppScore > myScore ? 'text-turquoise' : oppScore === myScore ? 'text-brass-light' : 'text-turquoise/40'
            }`}
          />
        </div>

        {/* Expand chevron */}
        <svg className="w-3 h-3 text-brass/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Stats BottomSheet */}
      <BottomSheet
        isOpen={expanded}
        onClose={() => setExpanded(false)}
        title="Match Stats"
        maxHeight="80vh"
      >
        <div className="space-y-1 mb-6">
          <StatRow label="CARTA" myVal={myCards} oppVal={oppCards} />
          <StatRow label="DINARI" myVal={myDinari} oppVal={oppDinari} />
          <StatRow label="BERMILA" myVal={mySevens} oppVal={oppSevens} />
          <StatRow label="7 HAYA" myVal={myHasHaya ? 1 : 0} oppVal={oppHasHaya ? 1 : 0} />
          <StatRow label="CHKOBBA" myVal={myChkobba} oppVal={oppChkobba} />
        </div>

        <div className="flex items-center justify-between px-2 py-4 border-t border-brass/20 mb-4">
          <div className="text-center">
            <div className="text-[9px] text-accent/60 font-ancient font-bold uppercase tracking-widest mb-1">Round</div>
            <span className="text-2xl font-ancient font-extrabold text-accent">{myRoundScore}</span>
          </div>
          <div className="bg-black/60 px-4 py-2 rounded-xl border border-brass/20">
            <span className="text-[10px] text-brass-light font-ancient font-black uppercase tracking-[0.4em]">TOTAL PTS</span>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-turquoise/60 font-ancient font-bold uppercase tracking-widest mb-1">Round</div>
            <span className="text-2xl font-ancient font-extrabold text-turquoise">{oppRoundScore}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {isHost && (
            <Button
              variant="primary"
              onClick={() => { socket.emit('reset_game'); setExpanded(false); }}
              className="w-full py-3 text-xs tracking-[0.2em]"
            >
              End Match & Edit Rules
            </Button>
          )}

          <button
            type="button"
            onClick={() => {
              socket.emit('leave_room');
              useUIStore.getState().setIsSubmitting(false);
              useUIStore.getState().setScreen('landing');
              sessionStorage.removeItem('chkobba-storage');
              setExpanded(false);
            }}
            className="w-full flex items-center justify-center py-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] hover:bg-red-500/15 transition-colors min-h-[44px]"
          >
            <span className="text-[11px] font-ancient uppercase tracking-[0.3em] font-black text-red-400/95">
              Leave Game
            </span>
          </button>

          <Button variant="secondary" onClick={() => setExpanded(false)} className="w-full py-3">
            Close
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
