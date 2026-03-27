import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '../../../stores/useUIStore';
import { useAmbianceSound } from '../../../hooks/useAmbianceSound';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
  }
}

const FIRST_VIDEO_ID = 'v7QJlY_WRBs';
const PLAYLIST_ID = 'RDv7QJlY_WRBs';

export function VintageRadio({ forceExpandedOnMobile = false }: { forceExpandedOnMobile?: boolean } = {}) {
  const [player, setPlayer] = useState<any>(null);
  const [isOn, setIsOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [volume, setVolume] = useState(35);
  const [tuningAngle, setTuningAngle] = useState(0);
  const [volumeAngle, setVolumeAngle] = useState(94); // 35% of 270
  const [apiReady, setApiReady] = useState(false);
  const [isMinimized, setIsMinimized] = useState(
    () => !forceExpandedOnMobile && window.innerWidth < 768,
  );
  const playerInitRef = useRef(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  // Waitress
  const isWaitressVisible = useUIStore((s) => s.isWaitressVisible);
  const setWaitressVisible = useUIStore((s) => s.setWaitressVisible);
  const setWaitressStatus = useUIStore((s) => s.setWaitressStatus);
  const { playWaitressVoice } = useAmbianceSound();

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }
    const exists = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!exists) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      setApiReady(true);
    };
  }, []);

  // Init player once API ready
  useEffect(() => {
    if (!apiReady || playerInitRef.current) return;
    playerInitRef.current = true;

    new window.YT.Player('yt-radio-player', {
      height: '1',
      width: '1',
      videoId: FIRST_VIDEO_ID,
      playerVars: {
        listType: 'playlist',
        list: PLAYLIST_ID,
        autoplay: 0,
        loop: 1,
        controls: 0,
      },
      events: {
        onReady: (e: any) => {
          e.target.setVolume(volume);
          setPlayer(e.target);
        },
        onStateChange: (e: any) => {
          const YT = window.YT;
          if (e.data === YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            const data = e.target.getVideoData();
            setCurrentTitle(data?.title || 'Unknown Track');
          } else if (e.data === YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (e.data === YT.PlayerState.ENDED) {
            // Auto-next
            e.target.nextVideo();
          }
        },
      },
    });
  }, [apiReady]);

  const titleContainerRef = useRef<HTMLDivElement>(null);
  // Check if title needs scrolling (duplicate marquee: half width = one copy)
  useEffect(() => {
    const inner = titleRef.current;
    const outer = titleContainerRef.current;
    if (!inner || !outer) return;
    setNeedsScroll(inner.scrollWidth / 2 > outer.clientWidth);
  }, [currentTitle]);

  // Power toggle
  const togglePower = useCallback(() => {
    if (!player) return;
    if (isOn) {
      player.pauseVideo();
      setIsOn(false);
      setIsPlaying(false);
    } else {
      player.playVideo();
      setIsOn(true);
    }
  }, [player, isOn]);

  // Play/Pause
  const togglePlay = useCallback(() => {
    if (!player || !isOn) {
      togglePower();
      return;
    }
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [player, isOn, isPlaying, togglePower]);

  // Next/Prev
  const nextTrack = useCallback(() => {
    if (!player) return;
    if (!isOn) { togglePower(); return; }
    player.nextVideo();
    setTuningAngle((a) => a + 30);
  }, [player, isOn, togglePower]);

  const prevTrack = useCallback(() => {
    if (!player) return;
    if (!isOn) { togglePower(); return; }
    player.previousVideo();
    setTuningAngle((a) => a - 30);
  }, [player, isOn, togglePower]);

  // Volume
  const adjustVolume = useCallback(
    (delta: number) => {
      const newVol = Math.max(0, Math.min(100, volume + delta));
      setVolume(newVol);
      setVolumeAngle(newVol * 2.7);
      if (player) player.setVolume(newVol);
    },
    [player, volume]
  );

  const handleVolumeWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation();
      adjustVolume(e.deltaY < 0 ? 5 : -5);
    },
    [adjustVolume]
  );

  // Waitress toggle
  const handleWaitress = useCallback(() => {
    if (isWaitressVisible) {
      setWaitressVisible(false);
      setWaitressStatus('idle');
    } else {
      setWaitressVisible(true);
      setWaitressStatus('serving');
      playWaitressVoice();
      setTimeout(() => setWaitressStatus('idle'), 3000);
    }
  }, [isWaitressVisible, setWaitressVisible, setWaitressStatus, playWaitressVoice]);

  // Volume knob drag
  const volumeKnobRef = useRef<HTMLDivElement>(null);
  const handleVolumeKnobDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const knob = volumeKnobRef.current;
      if (!knob) return;
      const rect = knob.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const clientX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
        const clientY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
        let angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
        // Remap: -135 (top-left) = 0%, 135 (bottom-left) = 100%
        angle = ((angle + 225) % 360);
        if (angle > 270) angle = angle > 315 ? 0 : 270;
        const vol = Math.round((angle / 270) * 100);
        setVolume(vol);
        setVolumeAngle(angle);
        if (player) player.setVolume(vol);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onUp);
    },
    [player]
  );

  // Tuning knob drag
  const tuningKnobRef = useRef<HTMLDivElement>(null);
  const tuningAccum = useRef(0);
  const handleTuningKnobDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const knob = tuningKnobRef.current;
      if (!knob) return;
      const rect = knob.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let lastAngle: number | null = null;
      tuningAccum.current = 0;

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const clientX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
        const clientY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
        const angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
        if (lastAngle !== null) {
          let delta = angle - lastAngle;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          tuningAccum.current += delta;
          setTuningAngle((a) => a + delta);
          // Every 60 degrees of rotation, change track
          if (tuningAccum.current > 60) {
            tuningAccum.current = 0;
            if (player && isOn) player.nextVideo();
          } else if (tuningAccum.current < -60) {
            tuningAccum.current = 0;
            if (player && isOn) player.previousVideo();
          }
        }
        lastAngle = angle;
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onUp);
    },
    [player, isOn]
  );

  // ─── STYLES — vintage wooden cabinet (#3d1f0a) ─────────────────
  const woodBase: React.CSSProperties = {
    backgroundColor: '#3d1f0a',
    backgroundImage: [
      'repeating-linear-gradient(88deg, transparent, transparent 3px, rgba(0,0,0,0.11) 3px, rgba(0,0,0,0.11) 4px)',
      'repeating-linear-gradient(2deg, transparent, transparent 6px, rgba(40,20,8,0.18) 6px, rgba(40,20,8,0.18) 7px)',
      'linear-gradient(165deg, rgba(255,255,255,0.05) 0%, transparent 42%, rgba(0,0,0,0.22) 100%)',
    ].join(', '),
  };

  const cabinetShadow =
    '0 14px 36px rgba(0,0,0,0.72), 0 4px 12px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,220,180,0.08), inset 0 -6px 14px rgba(0,0,0,0.38)';

  const goldKnobFace: React.CSSProperties = {
    background:
      'radial-gradient(circle at 32% 28%, #fff4c4 0%, #f0d060 12%, #c9a42e 38%, #8b6914 62%, #4a2c0a 88%, #2a1804 100%)',
    boxShadow:
      '0 8px 16px rgba(0,0,0,0.55), inset 0 3px 5px rgba(255,255,255,0.42), inset 0 -5px 10px rgba(0,0,0,0.55), inset -2px -2px 6px rgba(255,255,255,0.06)',
  };

  const brushedGoldBtn: React.CSSProperties = {
    background:
      'linear-gradient(135deg, #6e5518 0%, #c9a42e 14%, #8b7320 32%, #e8c547 48%, #7a6220 66%, #d4b84a 82%, #5c4810 100%)',
    backgroundSize: '180% 180%',
    boxShadow:
      'inset 0 1px 2px rgba(255,255,255,0.38), inset 0 -3px 5px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.45)',
  };

  /** Marshall-style woven grille — decorative center speaker */
  const marshallGrille: React.CSSProperties = {
    backgroundColor: '#0c0a08',
    backgroundImage: [
      'linear-gradient(33deg, rgba(255,255,255,0.06) 12%, transparent 12.5%, transparent 50%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.06) 62.5%, transparent 62.5%, transparent 100%)',
      'linear-gradient(-33deg, rgba(255,255,255,0.05) 12%, transparent 12.5%, transparent 50%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.05) 62.5%, transparent 62.5%, transparent 100%)',
      'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 4px)',
    ].join(', '),
    backgroundSize: '10px 10px, 10px 10px, 100% 100%',
    borderRadius: '8px',
    boxShadow:
      'inset 0 3px 14px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(212,175,55,0.12), 0 2px 8px rgba(0,0,0,0.5)',
    border: '3px solid #2a1e14',
    outline: '1px solid rgba(90,70,45,0.5)',
    outlineOffset: '-4px',
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    if (forceExpandedOnMobile && isMobile) {
      setIsMinimized(false);
    }
  }, [forceExpandedOnMobile, isMobile]);

  const isCompactMobile = forceExpandedOnMobile && isMobile;

  const smallKnobSize = isCompactMobile ? 22 : isMobile ? 28 : 34;
  const bigKnobSize = isCompactMobile ? 34 : isMobile ? 44 : 52;

  if (isMinimized) {
    return (
      <>
        {/* Hidden YouTube player */}
        <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
          <div id="yt-radio-player" />
        </div>
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (forceExpandedOnMobile && isMobile) {
              setIsMinimized(false);
              return;
            }
            isMobile ? togglePlay() : setIsMinimized(false);
          }}
          className="fixed top-[max(5rem,env(safe-area-inset-top)+1rem)] left-[max(0.5rem,env(safe-area-inset-left))] z-50 cursor-pointer"
          title={isMobile ? (isPlaying ? 'Pause radio' : 'Play radio') : 'Open Radio'}
          aria-label={isMobile ? (isPlaying ? 'Pause café radio' : 'Play café radio') : 'Expand radio controls'}
          style={{
            width: isMobile ? 36 : 48,
            height: isMobile ? 36 : 48,
            borderRadius: 10,
            ...woodBase,
            boxShadow: cabinetShadow,
            border: '2px solid #2a1508',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: isMobile ? 16 : 22 }}>📻</span>
          {isOn && (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 6px #4ade80',
              }}
            />
          )}
        </motion.button>
      </>
    );
  }

  return (
    <>
      {/* Hidden YouTube player */}
      <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
        <div id="yt-radio-player" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className={`fixed left-[max(0.5rem,env(safe-area-inset-left))] ${
          isCompactMobile
            ? 'bottom-[max(3.9rem,env(safe-area-inset-bottom)+3.45rem)] origin-bottom-left'
            : 'top-[max(1rem,env(safe-area-inset-top)+0.5rem)]'
        } z-50 select-none ${
          isMobile ? '' : 'max-[height:920px]:origin-top-left max-[height:920px]:scale-[0.88] max-[height:780px]:scale-[0.8]'
        }`}
        style={{
          width: isCompactMobile ? 152 : isMobile ? 208 : 276,
          maxWidth: isMobile ? 'calc(100vw - 1rem)' : 'min(276px, calc(100vw - 20rem))',
        }}
        role="group"
        aria-label="Radio du café — affichage du titre, réglage, lecture et pistes."
      >
        {/* ─── RADIO BODY — dark wood cabinet ─── */}
        <div
          style={{
            ...woodBase,
            borderRadius: isCompactMobile ? 10 : isMobile ? 12 : 16,
            boxShadow: cabinetShadow,
            border: '2px solid #2a1508',
            padding: 0,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              backgroundImage:
                'repeating-linear-gradient(92deg, transparent, transparent 5px, rgba(0,0,0,0.06) 5px, rgba(0,0,0,0.06) 6px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              background:
                'linear-gradient(168deg, rgba(255,255,255,0.06) 0%, transparent 38%, transparent 62%, rgba(0,0,0,0.12) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* ─── HANDLE ─── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
              top: isCompactMobile ? -2 : isMobile ? -4 : -6,
              zIndex: 2,
              cursor: 'pointer',
            }}
            onClick={() => {
              if (!isMobile || !forceExpandedOnMobile) setIsMinimized(true);
            }}
            title="Minimize radio"
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
              <div
                style={{
                  width: isCompactMobile ? 5 : isMobile ? 7 : 10,
                  height: isCompactMobile ? 8 : isMobile ? 12 : 18,
                  borderLeft: `${isCompactMobile ? 1.5 : isMobile ? 2 : 3}px solid #6a6a6a`,
                  borderTop: `${isCompactMobile ? 1.5 : isMobile ? 2 : 3}px solid #8a8a8a`,
                  borderRadius: '4px 0 0 0',
                  background: 'transparent',
                }}
              />
              <div
                style={{
                  width: isCompactMobile ? 34 : isMobile ? 48 : 72,
                  height: isCompactMobile ? 4 : isMobile ? 5 : 8,
                  background: 'linear-gradient(180deg, #b8b8b8 0%, #707070 45%, #909090 60%, #787878 100%)',
                  borderRadius: '4px 4px 0 0',
                  boxShadow: '0 -2px 5px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.35)',
                  marginBottom: isCompactMobile ? 3 : isMobile ? 6 : 10,
                }}
              />
              <div
                style={{
                  width: isCompactMobile ? 5 : isMobile ? 7 : 10,
                  height: isCompactMobile ? 8 : isMobile ? 12 : 18,
                  borderRight: `${isCompactMobile ? 1.5 : isMobile ? 2 : 3}px solid #6a6a6a`,
                  borderTop: `${isCompactMobile ? 1.5 : isMobile ? 2 : 3}px solid #8a8a8a`,
                  borderRadius: '0 4px 0 0',
                  background: 'transparent',
                }}
              />
            </div>
          </div>

          <div style={{ padding: isCompactMobile ? '0 7px 7px 7px' : isMobile ? '0 10px 10px 10px' : '0 14px 12px 14px' }}>
            {/* Top: engraved RADIO + power + café strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: isCompactMobile ? 5 : isMobile ? 8 : 10,
                padding: isCompactMobile ? '4px 7px' : isMobile ? '6px 10px' : '7px 12px',
                borderRadius: 8,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)',
                border: '1px solid rgba(0,0,0,0.45)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,200,160,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: isCompactMobile ? 5 : isMobile ? 8 : 10 }}>
                <span
                  style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: isCompactMobile ? 9 : isMobile ? 11 : 13,
                    fontWeight: 700,
                    fontVariant: 'small-caps',
                    letterSpacing: '0.32em',
                    color: '#f0dcc0',
                    textShadow:
                      '0 0 12px rgba(212,175,55,0.35), 0 1px 0 rgba(255,255,255,0.45), 0 2px 3px rgba(0,0,0,0.95), 0 -1px 1px rgba(0,0,0,0.85)',
                    userSelect: 'none',
                  }}
                >
                  RADIO
                </span>
                <motion.button
                  type="button"
                  animate={
                    isOn
                      ? { boxShadow: ['0 0 6px rgba(34,197,94,0.35)', '0 0 14px rgba(251,191,36,0.45)', '0 0 6px rgba(34,197,94,0.35)'] }
                      : { boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.75)' }
                  }
                  transition={{ duration: 2, repeat: isOn ? Infinity : 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePower();
                  }}
                  title={isOn ? 'Éteindre' : 'Allumer'}
                  aria-label={isOn ? 'Éteindre la radio' : 'Allumer la radio'}
                  style={{
                    width: isMobile ? 22 : 26,
                    height: isMobile ? 22 : 26,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: '1px solid rgba(0,0,0,0.55)',
                    cursor: 'pointer',
                    padding: 0,
                    background: isOn
                      ? 'radial-gradient(circle at 35% 28%, #b8ffc8 0%, #22c55e 45%, #14532d 100%)'
                      : 'radial-gradient(circle at 50% 50%, #3f3f3f 0%, #151515 100%)',
                    boxShadow: isOn
                      ? '0 0 14px rgba(34,197,94,0.55), inset 0 2px 2px rgba(255,255,255,0.35), inset 0 -3px 5px rgba(0,0,0,0.45)'
                      : 'inset 0 3px 6px rgba(0,0,0,0.75)',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: isCompactMobile ? 6 : isMobile ? 7 : 8,
                  color: 'rgba(255,220,180,0.38)',
                  letterSpacing: '0.14em',
                  whiteSpace: 'nowrap',
                }}
              >
                café · playlist
              </span>
            </div>

            {/* Tuning knob | speaker (track title on grille) | volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isCompactMobile ? 4 : isMobile ? 6 : 8, marginBottom: isCompactMobile ? 5 : isMobile ? 8 : 10 }}>
              <div
                ref={tuningKnobRef}
                onMouseDown={handleTuningKnobDown}
                onTouchStart={handleTuningKnobDown}
                title="Tuning — tournez pour changer de piste"
                style={{
                  width: bigKnobSize,
                  height: bigKnobSize,
                  minWidth: bigKnobSize,
                  borderRadius: '50%',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transform: `rotate(${tuningAngle}deg)`,
                  ...goldKnobFace,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background:
                      'conic-gradient(from 210deg, transparent 0deg, rgba(255,255,255,0.5) 28deg, transparent 58deg, transparent 360deg)',
                    pointerEvents: 'none',
                    mixBlendMode: 'soft-light',
                    opacity: 0.85,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 5,
                    left: '50%',
                    marginLeft: -1.5,
                    width: 3,
                    height: 12,
                    background: '#1f0f06',
                    borderRadius: 2,
                    boxShadow: '0 0 2px rgba(0,0,0,0.6)',
                  }}
                />
                <div
                  style={{
                    width: bigKnobSize - 12,
                    height: bigKnobSize - 12,
                    borderRadius: '50%',
                    border: '1px solid rgba(0,0,0,0.4)',
                    boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.45)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              <div
                style={{
                  ...marshallGrille,
                  flex: 1,
                  minHeight: isCompactMobile ? 54 : isMobile ? 72 : 88,
                  height: isCompactMobile ? 54 : isMobile ? 72 : 88,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: 'default',
                  overflow: 'hidden',
                }}
                role="group"
                aria-label="Now playing"
              >
                {(isCompactMobile ? [0, 1, 2, 3] : isMobile ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6]).map((i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: isCompactMobile ? 4 : isMobile ? 5 : 8,
                      right: isCompactMobile ? 4 : isMobile ? 5 : 8,
                      top: (isCompactMobile ? 4 : isMobile ? 5 : 8) + i * (isCompactMobile ? 7 : isMobile ? 8 : 9),
                      height: 1,
                      background: 'rgba(139,105,20,0.12)',
                      zIndex: 1,
                    }}
                  />
                ))}
                {/* Track title readout — inset on the speaker mesh */}
                <div
                  style={{
                    position: 'absolute',
                    inset: isCompactMobile ? 5 : isMobile ? 7 : 10,
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.62)',
                    border: '1px solid rgba(212,175,55,0.28)',
                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)',
                    zIndex: 4,
                    display: 'flex',
                    alignItems: 'center',
                    padding: isCompactMobile ? '4px 6px' : isMobile ? '6px 8px' : '8px 10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    ref={titleContainerRef}
                    style={{
                      width: '100%',
                      overflow: 'hidden',
                      minHeight: isCompactMobile ? 22 : isMobile ? 28 : 32,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isOn && currentTitle ? (
                      <div
                        ref={titleRef}
                        style={{
                          display: 'inline-flex',
                          whiteSpace: 'nowrap',
                          animation: needsScroll ? 'radio-scroll-title 14s linear infinite' : 'none',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: '"Courier New", monospace',
                            fontSize: isCompactMobile ? 7 : isMobile ? 9 : 11,
                            fontWeight: 700,
                            color: '#ecfccb',
                            textShadow:
                              '0 0 8px rgba(34,197,94,0.85), 0 0 2px rgba(253,224,71,0.45)',
                            letterSpacing: 0.35,
                          }}
                        >
                          ♪ {currentTitle}
                        </span>
                        <span
                          aria-hidden
                          style={{
                            paddingLeft: '2.5rem',
                            fontFamily: '"Courier New", monospace',
                            fontSize: isCompactMobile ? 7 : isMobile ? 9 : 11,
                            fontWeight: 700,
                            color: '#ecfccb',
                            textShadow:
                              '0 0 8px rgba(34,197,94,0.85), 0 0 2px rgba(253,224,71,0.45)',
                            letterSpacing: 0.35,
                          }}
                        >
                          ♪ {currentTitle}
                        </span>
                      </div>
                    ) : isOn ? (
                      <motion.span
                        style={{
                          fontFamily: '"Courier New", monospace',
                          fontSize: isCompactMobile ? 7 : isMobile ? 9 : 10,
                          fontWeight: 600,
                          color: 'rgba(212,175,55,0.85)',
                          letterSpacing: '0.08em',
                        }}
                        animate={{ opacity: [0.55, 1, 0.55] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                      >
                        Loading track…
                      </motion.span>
                    ) : (
                      <span
                        style={{
                          fontFamily: '"Courier New", monospace',
                          fontSize: isCompactMobile ? 7 : isMobile ? 9 : 10,
                          fontWeight: 600,
                          color: 'rgba(212,175,55,0.4)',
                          letterSpacing: '0.15em',
                        }}
                      >
                        — off —
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                ref={volumeKnobRef}
                onMouseDown={handleVolumeKnobDown}
                onTouchStart={handleVolumeKnobDown}
                onWheel={handleVolumeWheel}
                title={`Volume: ${volume}% — glisser ou molette`}
                style={{
                  width: bigKnobSize,
                  height: bigKnobSize,
                  minWidth: bigKnobSize,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'transform 0.15s ease',
                  transform: `rotate(${volumeAngle - 135}deg)`,
                  ...goldKnobFace,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background:
                      'conic-gradient(from 30deg, transparent 0deg, rgba(255,255,255,0.45) 32deg, transparent 62deg, transparent 360deg)',
                    pointerEvents: 'none',
                    mixBlendMode: 'soft-light',
                    opacity: 0.85,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 5,
                    left: '50%',
                    marginLeft: -1.5,
                    width: 3,
                    height: 12,
                    background: '#1f0f06',
                    borderRadius: 2,
                    boxShadow: '0 0 2px rgba(0,0,0,0.6)',
                  }}
                />
                <div
                  style={{
                    width: bigKnobSize - 12,
                    height: bigKnobSize - 12,
                    borderRadius: '50%',
                    border: '1px solid rgba(0,0,0,0.4)',
                    boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.45)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* Prev | play/pause | next — brushed gold + waitress */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: isCompactMobile ? 6 : isMobile ? 10 : 14,
                marginBottom: isCompactMobile ? 4 : isMobile ? 6 : 8,
              }}
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={prevTrack}
                title="Piste précédente"
                aria-label="Piste précédente"
                style={{
                  width: smallKnobSize,
                  height: smallKnobSize,
                  borderRadius: '50%',
                  ...brushedGoldBtn,
                  border: '1px solid rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2a1a06',
                  fontSize: isCompactMobile ? 11 : isMobile ? 13 : 15,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ⏮
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={togglePlay}
                title={!isOn ? 'Allumer et lire' : isPlaying ? 'Pause' : 'Lecture'}
                aria-label={!isOn ? 'Allumer la radio' : isPlaying ? 'Pause' : 'Lecture'}
                style={{
                  width: smallKnobSize + (isCompactMobile ? 2 : isMobile ? 4 : 6),
                  height: smallKnobSize + (isCompactMobile ? 2 : isMobile ? 4 : 6),
                  borderRadius: '50%',
                  ...brushedGoldBtn,
                  border: '1px solid rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2a1a06',
                  fontSize: isCompactMobile ? 12 : isMobile ? 15 : 17,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                {!isOn ? '▶' : isPlaying ? '⏸' : '▶'}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={nextTrack}
                title="Piste suivante"
                aria-label="Piste suivante"
                style={{
                  width: smallKnobSize,
                  height: smallKnobSize,
                  borderRadius: '50%',
                  ...brushedGoldBtn,
                  border: '1px solid rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2a1a06',
                  fontSize: isCompactMobile ? 11 : isMobile ? 13 : 15,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ⏭
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleWaitress}
                title={isWaitressVisible ? 'Renvoyer la serveuse' : 'Appeler la serveuse'}
                aria-label={isWaitressVisible ? 'Renvoyer la serveuse' : 'Appeler la serveuse'}
                style={{
                  width: smallKnobSize - (isCompactMobile ? 4 : 6),
                  height: smallKnobSize - (isCompactMobile ? 4 : 6),
                  borderRadius: '50%',
                  ...brushedGoldBtn,
                  border: '1px solid rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isCompactMobile ? 10 : isMobile ? 12 : 14,
                  lineHeight: 1,
                  padding: 0,
                  boxShadow: isWaitressVisible
                    ? 'inset 0 1px 2px rgba(255,255,255,0.38), inset 0 -3px 5px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.45), 0 0 12px rgba(251,191,36,0.35)'
                    : 'inset 0 1px 2px rgba(255,255,255,0.38), inset 0 -3px 5px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.45)',
                }}
              >
                ☕
              </motion.button>
            </div>

            <div
              style={{
                marginTop: isCompactMobile ? 1 : isMobile ? 2 : 4,
                height: isCompactMobile ? 1 : isMobile ? 2 : 3,
                background:
                  'linear-gradient(90deg, transparent, rgba(212,175,55,0.18) 22%, rgba(212,175,55,0.28) 50%, rgba(212,175,55,0.18) 78%, transparent)',
                borderRadius: 2,
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: isCompactMobile ? '0 8px' : isMobile ? '0 12px' : '0 16px', marginTop: isCompactMobile ? 2 : 4 }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    width: isCompactMobile ? 9 : isMobile ? 12 : 16,
                    height: isCompactMobile ? 2 : isMobile ? 3 : 4,
                    background: 'linear-gradient(180deg, #4a2810, #1f0c04)',
                    borderRadius: '0 0 5px 5px',
                    boxShadow: '0 3px 4px rgba(0,0,0,0.5)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: isCompactMobile ? '2px 10px 0' : isMobile ? '3px 16px 0' : '4px 20px 0',
            fontFamily: '"Courier New", serif',
            fontSize: isCompactMobile ? 5 : isMobile ? 6 : 7,
            color: 'rgba(212,175,55,0.42)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          <span title="Tuning">Tune</span>
          <span title="Volume">Vol {volume}%</span>
        </div>
      </motion.div>
    </>
  );
}
