Mobile Redesign Plan
I need you to completely redesign the mobile UI for my card game. The current version is heavily cluttered — elements overlap, the screen feels cramped, and players can't clearly see what's happening. Keep all existing features but rebuild the layout from scratch for mobile.

Goal
Create a completely separate mobile layout for screens under 640px.
Desktop layout must remain 100% untouched.

Current Problems
Emote/SFX panel overlaps hand cards
Scoreboard, sound slide and game room code overlaps game table
Radio is not showing
Everything too cramped

Target Architecture (mobile only)
CSS Grid with 4 strict rows:
Row 1: compact scoreboard — max 60px
Row 2: game table — flex-1
Row 3: player hand — fixed 140px
Row 4: action bar — 56px (PLAY + CHAT + SFX buttons)

New Files to Create
client/src/hooks/useIsMobile.ts
client/src/components/mobile/MobileGameLayout.tsx
client/src/components/mobile/BottomSheet.tsx
client/src/components/mobile/MobileActionBar.tsx
client/src/components/mobile/MobileScoreboard.tsx

Rules
Zero changes to game logic
Zero changes to desktop layout
All existing components reused inside mobile layout
tsc --noEmit must pass