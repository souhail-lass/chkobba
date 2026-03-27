# Mobile UI Redesign Plan

## Context
The current game screen uses fixed-positioned overlays for scoreboard, SFX controls, chat, and radio. On screens < 640px these elements stack on top of cards and the play button, making the game unplayable. MOBILE.md specifies a clean CSS Grid with 4 strict rows that eliminates all overlap. Desktop layout must stay 100% untouched.

---

## Architecture: 4-Row CSS Grid (mobile only, < 640px)

```
Row 1:  60px   → MobileScoreboard
Row 2:  1fr    → GameTable (table cards only, hand removed)
Row 3:  minmax(150px, auto) → PlayerHand standalone
Row 4:  56px   → MobileActionBar (PLAY · CHAT · SFX/EMOTES)
```

Grid inline style: `gridTemplateRows: '60px 1fr minmax(150px,auto) 56px'`
Use `minmax(150px,auto)` for Row 3 (not hard `140px`) to accommodate `PlayerHand`'s `min-h-[clamp(88px,16vh,180px)]` without clipping.

---

## New Files

### 1. `client/src/hooks/useIsMobile.ts`
```ts
export function useIsMobile(): boolean
```
- `useState(() => window.innerWidth < 640)` — threshold matches Tailwind `sm:` breakpoint
- `useEffect` adds/removes `resize` listener
- Returns boolean

---

### 2. `client/src/components/mobile/BottomSheet.tsx`
```tsx
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxHeight?: string; // default '70vh'
}
```
- `AnimatePresence` + `motion.div` with `initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}`
- `transition={{ type:'spring', stiffness:400, damping:35 }}`
- Backdrop: `fixed inset-0 bg-black/70 z-[150]` — click calls `onClose`
- Sheet panel: `fixed bottom-0 left-0 right-0 z-[160] rounded-t-2xl bg-[#0f1a0e] border-t border-brass/20 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]`
- Handle bar: `w-10 h-1 rounded-full bg-white/20 mx-auto mb-3`

---

### 3. `client/src/components/mobile/MobileScoreboard.tsx`
```tsx
export function MobileScoreboard(): JSX.Element | null
```
Reads `useGameStore` directly (no props).

**Collapsed state (always visible, 60px row):**
- 3-col flex: `[avatar24 + name + score] · [VS badge + RD N] · [score + name + avatar24]`
- `h-full flex items-center px-3 gap-2 bg-black/50 backdrop-blur-sm border-b border-brass/15`
- Tapping calls `setExpanded(true)`

**Expanded state:**
- Renders `<BottomSheet isOpen={expanded} onClose={() => setExpanded(false)} title="Match Stats">`
- Inside: StatRow-style layout for CARTA / DINARI / BERMILA / 7 HAYA / CHKOBBA + round scores
- Uses local `AnimatedNumber` helper (copy from `Scoreboard.tsx` — not exported)
- "Leave Game" button: `socket.emit('leave_room')` → reset → `setScreen('landing')`
- Host-only "End Match" button: `socket.emit('reset_game')`
- Reads same store fields as `Scoreboard.tsx`: `gameState.scores`, `capturedCount`, `chkobbaCount`, `dinariCount`, `sevensCount`, `hasHaya`, `roundScores`, `room?.hostId`

---

### 4. `client/src/components/mobile/MobileActionBar.tsx`
```tsx
interface MobileActionBarProps {
  roomId: string;
  onCopyCode: () => void;
  copied: boolean;
}
export function MobileActionBar({ roomId, onCopyCode, copied }: MobileActionBarProps): JSX.Element
```

**Layout:** `h-14 flex items-center px-2 gap-1 bg-black/85 backdrop-blur-xl border-t border-brass/20 pb-[env(safe-area-inset-bottom)] w-full`

**4 zones (flex-1 each):**

| Zone | Content |
|------|---------|
| PLAY | Active on your turn; label: PLAY / DROP / CAPTURE / INVALID |
| CHAT | Calls `useChatStore.getState().toggleChat()`; unread badge |
| SFX/EMOTES | Opens `BottomSheet` with `<SoundEffectsControls />` + `<EmotePanel />` |
| ROOM | Small code + copy icon; calls `onCopyCode` |

**PLAY button logic (self-contained in MobileActionBar):**
- Subscribe: `selectedCardIndex`, `selectedTableIndices`, `gameState`, `playerId`, `isDistributing`, `clearSelections` from `useGameStore`
- Local `playSubmitLockedRef = useRef(false)` + `playPending` state
- `canPlay` computation mirrors `PlayerHand.tsx` exactly
- `handlePlay()` → `stopCelebrationPlayback()` → `socket.emit('play_card', { cardIndex, tableIndices })` → `clearSelections()`
- Lock-release `useEffect` watching `gameState?.currentTurn`, `gameState?.roundNumber`, `isDistributing` — same pattern as `PlayerHand`
- `socket.on('error', releasePlayLock)` cleanup

**Imports needed:**
```ts
import { socket } from '../../lib/socket';
import { stopCelebrationPlayback } from '../../lib/playAssetSound';
import { useGameStore } from '../../stores/useGameStore';
import { useChatStore } from '../../stores/useChatStore';
import { SoundEffectsControls } from '../game/SoundEffectsControls';
import { EmotePanel } from '../game/EmotePanel';
import { BottomSheet } from './BottomSheet';
```

---

### 5. `client/src/components/mobile/MobileGameLayout.tsx`
```tsx
interface MobileGameLayoutProps {
  tableShakeRef: RefObject<HTMLDivElement | null>;
  autoWinWarning: { timeRemaining: number; playerNickname: string } | null;
  onCopyCode: () => void;
  copied: boolean;
  gameState: GameState;
  playerId: string;
}
export function MobileGameLayout(props: MobileGameLayoutProps): JSX.Element
```

**Structure:**
```tsx
<div style={{ display:'grid', gridTemplateRows:'60px 1fr minmax(150px,auto) 56px',
              height:'100dvh', maxHeight:'100dvh', overflow:'hidden' }}>
  {/* Row 1 */}
  <div className="relative z-[45] overflow-hidden border-b border-brass/10">
    <MobileScoreboard />
  </div>

  {/* Row 2 */}
  <div className="relative z-10 min-h-0 overflow-hidden">
    <GameTable tableShakeRef={tableShakeRef} hideHand />
  </div>

  {/* Row 3 — hand + self-emote bubble */}
  <div className="relative z-[30] overflow-visible w-full">
    <AnimatePresence>
      {emoteFlashes[playerId] && (
        <motion.div className="absolute -top-1 left-1/2 z-40 -translate-x-1/2 -translate-y-full
                               flex items-center gap-1.5 rounded-lg border border-brass/40
                               bg-black/85 px-2 py-1 shadow-lg pointer-events-none">
          <span className="text-lg leading-none">{emoteFlashes[playerId]!.icon}</span>
          <span className="font-ancient text-[9px] text-cream uppercase tracking-wider">
            {emoteFlashes[playerId]!.label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
    <PlayerHand hidePlayButton />
  </div>

  {/* Row 4 */}
  <div className="relative z-[80]">
    <MobileActionBar roomId={gameState.roomId} onCopyCode={onCopyCode} copied={copied} />
  </div>
</div>
```

**Also rendered (outside grid, as fixed overlays):**
```tsx
{autoWinWarning && (
  <motion.div className="fixed left-1/2 -translate-x-1/2 z-[90] top-[max(4rem,...)] ...">
    {/* same content as GameScreen's autoWinWarning */}
  </motion.div>
)}

{createPortal(
  <>
    <ChkobbaEffect tableShakeRef={tableShakeRef as RefObject<HTMLElement|null>} />
    <HayyaEffect tableShakeRef={tableShakeRef as RefObject<HTMLElement|null>} />
  </>,
  document.body
)}

<RoundEndModal />
<GameOverModal />
```

**Reads from stores:**
- `useEmoteStore((s) => s.flashes)` for self-emote bubble

**Does NOT render:** `VintageRadio`, `Scoreboard`, `MoveLog`, SFX fixed div
(VintageRadio omitted on mobile to keep layout clean; SFX accessible via action bar)

---

## Modified Existing Files

### `GameTable.tsx` — add `hideHand?: boolean`
```tsx
export function GameTable({
  tableShakeRef,
  hideHand,
}: {
  tableShakeRef?: RefObject<HTMLDivElement | null>;
  hideHand?: boolean;
})
```
Wrap the entire hand container div (lines ~168–186) with `{!hideHand && ( ... )}`. The `TurnIndicator` at line 165 stays unconditionally — it lives between the table and hand in the flex column and should remain visible.

### `PlayerHand.tsx` — add `hidePlayButton?: boolean`
```tsx
export function PlayerHand({ hidePlayButton }: { hidePlayButton?: boolean } = {})
```
Wrap the `<motion.button>` PLAY/DROP/CAPTURE button (lines ~199–220) with `{!hidePlayButton && ( ... )}`. All logic variables (`canPlay`, `handleConfirmPlay`, etc.) remain inside — no extraction needed.

### `ChatPanel.tsx` — add `hideTrigger?: boolean`
```tsx
export function ChatPanel({ hideTrigger }: { hideTrigger?: boolean } = {})
```
Wrap the entire `<div className="mt-2 flex flex-row items-center gap-2 ...">` button row (lines ~217–247) with `{!hideTrigger && ( ... )}`. The messages panel renders normally; only the floating trigger button is suppressed.

### `GameScreen.tsx` — add mobile branch
```tsx
const isMobile = useIsMobile();

// After rummy + loading early returns, before the desktop return:
if (isMobile) {
  return (
    <motion.section id="game-screen" initial={{ opacity:0 }} animate={{ opacity:1 }}
      exit={{ opacity:0 }} transition={{ duration:0.5 }}
      className="h-[100dvh] max-h-[100dvh] relative overflow-hidden bg-transparent">
      {/* ambient lighting divs — copy from desktop */}
      <MobileGameLayout
        tableShakeRef={tableShakeRef}
        autoWinWarning={autoWinWarning}
        onCopyCode={handleCopyCode}
        copied={copied}
        gameState={gameState}
        playerId={playerId}
      />
    </motion.section>
  );
}
return ( /* existing desktop JSX — zero changes */ );
```

### `App.tsx` — pass `hideTrigger` to ChatPanel
```tsx
// Add at top of App():
const isMobile = useIsMobile();

// Line 71:
{screen === 'game' && <ChatPanel hideTrigger={isMobile} />}
```

---

## Z-Index Coordination

| Element | z-index |
|---------|---------|
| Game table (Row 2) | 10 |
| Player zones | 30 |
| Player hand (Row 3) | 30 |
| MobileScoreboard (Row 1) | 45 |
| Action bar (Row 4) | 80 |
| AutoWin warning | 90 |
| RoundEndModal / GameOverModal | 100 |
| ChatPanel (fixed overlay) | 200 |
| BottomSheet backdrop | 150 |
| BottomSheet panel | 160 |
| ChkobbaEffect / HayyaEffect (portal) | 250+ |

Use inline `style={{ zIndex: N }}` on grid row wrappers — no changes to `tailwind.config.js`.

---

## TypeScript Notes (`tsc --noEmit`)

- `strict: false` in tsconfig — main risks are null access and missing imports
- All `gameState?.` accesses in `MobileActionBar` need optional chaining
- `tableShakeRef as RefObject<HTMLElement | null>` cast — same pattern already in `GameScreen.tsx`
- `PlayerHand` and `ChatPanel` use default-parameter destructuring for optional props: `function Foo({ bar }: { bar?: boolean } = {})`
- `MobileGameLayout` imports: `createPortal` from `react-dom`, `AnimatePresence`+`motion` from `framer-motion`
- `MobileActionBar` imports: `socket`, `stopCelebrationPlayback`, stores, `SoundEffectsControls`, `EmotePanel`, `BottomSheet`
- Relative import depth from `mobile/`: `../../stores/`, `../../hooks/`, `../../lib/`, `../game/`

---

## Implementation Order

1. `useIsMobile.ts` — no deps
2. `BottomSheet.tsx` — framer-motion only
3. `MobileScoreboard.tsx` — needs `BottomSheet`
4. `MobileActionBar.tsx` — needs `BottomSheet`, stores, `SoundEffectsControls`, `EmotePanel`
5. Modify `GameTable.tsx` — add `hideHand` prop
6. Modify `PlayerHand.tsx` — add `hidePlayButton` prop
7. Modify `ChatPanel.tsx` — add `hideTrigger` prop
8. `MobileGameLayout.tsx` — needs all above
9. Modify `GameScreen.tsx` — add `useIsMobile` + mobile branch
10. Modify `App.tsx` — add `useIsMobile` + pass `hideTrigger`

Steps 1–4 are fully parallel. Steps 5–7 are independent of each other.

---

## Verification

1. `npx tsc --noEmit` from `client/` — must pass clean
2. Desktop (≥ 640px): pixel-identical to before; `MobileGameLayout` never mounts
3. Mobile (< 640px, Chrome DevTools iPhone SE 375×667):
   - All 4 rows visible at correct heights
   - No overflow, no scroll on outer container
   - Cards readable, no overlap with action bar
4. Play card: select → PLAY in action bar activates → tap → `play_card` emits → hand clears
5. Chat: tap CHAT in action bar → ChatPanel panel opens (floating trigger button is gone)
6. SFX: tap SFX button → BottomSheet slides up with volume slider + emotes
7. Scoreboard: tap → BottomSheet slides up with full stats
8. Chkobba/Hayya effects render above all mobile UI
9. RoundEndModal and GameOverModal appear correctly
10. Resize 375px → 700px: layout switches to desktop without reload
