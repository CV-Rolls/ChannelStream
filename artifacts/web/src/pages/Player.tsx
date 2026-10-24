import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Tv, Heart, Timer, Share2, PictureInPicture2,
  Activity, X, MonitorPlay, RotateCcw, Clapperboard,
  Captions, CaptionsOff, Gauge, Maximize2, Minimize2,
} from "lucide-react";
import { useGetChannel } from "@workspace/api-client-react";
import { VideoPlayer, type VideoPlayerHandle, type StreamStats, type QualityLevelItem, type SubtitleTrackItem } from "@/components/VideoPlayer";
import { useFavorites } from "@/hooks/use-favorites";
import { useRecentlyWatched } from "@/hooks/use-recently-watched";
import { useToast } from "@/hooks/use-toast";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useFullscreenOrientationLock } from "@/hooks/use-orientation-lock";
import { useOverlayControls } from "@/hooks/use-overlay-controls";
import { usePortraitMobile } from "@/hooks/use-portrait-mobile";
import { motion, AnimatePresence } from "framer-motion";

interface EpgProgram {
  id: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  category?: string | null;
}

function useCurrentEpg(channelId: string | undefined) {
  const [program, setProgram] = useState<EpgProgram | null>(null);
  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/epg/${encodeURIComponent(channelId)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setProgram(data.current ?? null);
      } catch {}
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [channelId]);
  return program;
}

const SLEEP_OPTIONS = [15, 30, 60, 90] as const;
type SleepMinutes = typeof SLEEP_OPTIONS[number];

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const playerRef = useRef<VideoPlayerHandle>(null);
  const { toast } = useToast();

  const { data: channel, isLoading, isError } = useGetChannel(id || "");
  const { isFavorite, toggleFavorite }         = useFavorites();
  const { addRecent }                          = useRecentlyWatched();

  // ── Recently watched ──────────────────────────────────────────────────────
  useEffect(() => {
    if (channel) {
      addRecent({
        id:         channel.id,
        name:       channel.name,
        logo:       channel.logo,
        quality:    channel.quality,
        country:    channel.country,
        categories: channel.categories,
      });
    }
  }, [channel?.id]);

  // ── Sleep timer ───────────────────────────────────────────────────────────
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sleepEnded, setSleepEnded] = useState(false);

  const startSleepTimer = useCallback((mins: SleepMinutes) => {
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    setSleepMenuOpen(false);
    setSleepEnded(false);
    setSleepRemaining(mins * 60);
    sleepIntervalRef.current = setInterval(() => {
      setSleepRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(sleepIntervalRef.current!);
          playerRef.current?.pause();
          setSleepEnded(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const cancelSleep = useCallback(() => {
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    setSleepRemaining(null);
    setSleepEnded(false);
  }, []);

  useEffect(() => () => { if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current); }, []);

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: channel?.name ?? "NetStream", url }); return; }
      catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Share this link to watch the same channel." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the URL from your address bar.", variant: "destructive" });
    }
  };

  // ── PiP ───────────────────────────────────────────────────────────────────
  const [isPiP, setIsPiP] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  useEffect(() => {
    setPipSupported(typeof document !== "undefined" && !!document.pictureInPictureEnabled);
    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);
    document.addEventListener("enterpictureinpicture", onEnter);
    document.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      document.removeEventListener("enterpictureinpicture", onEnter);
      document.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, []);

  const handlePiP = () => playerRef.current?.requestPiP();

  // ── TV Mode ───────────────────────────────────────────────────────────────
  const [tvMode, setTvMode] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") setTvMode((v) => !v);
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        const video = document.querySelector("video");
        if (video) video.paused ? video.play() : video.pause();
      }
      if (e.key === "Escape" && tvMode) setTvMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tvMode]);

  // ── Quality levels ────────────────────────────────────────────────────────
  const [qualityLevels, setQualityLevels]   = useState<QualityLevelItem[]>([]);
  const [currentLevel, setCurrentLevel]     = useState<number>(-1);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);

  // ── Captions ──────────────────────────────────────────────────────────────
  const [subtitleTracks, setSubtitleTracks]   = useState<SubtitleTrackItem[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1);
  const [captionsMenuOpen, setCaptionsMenuOpen] = useState(false);

  // ── Stream stats ──────────────────────────────────────────────────────────
  const [stats, setStats]         = useState<StreamStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  // ── Overlay: tap-to-toggle with auto-hide (via hook) ─────────────────────
  const { visible: showOverlay, show: bumpOverlay, toggle: toggleOverlay } = useOverlayControls(3500);

  const handlePlayerTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Button/link taps just reset the timer — don't toggle the overlay away
    if (target.closest("button, a, [role=button], select")) {
      bumpOverlay();
      return;
    }
    toggleOverlay();
  }, [bumpOverlay, toggleOverlay]);

  // ── Screen Wake Lock (via hook) ───────────────────────────────────────────
  useWakeLock(!!channel);

  // ── Orientation lock on fullscreen (via hook) ─────────────────────────────
  useFullscreenOrientationLock();

  // ── Fullscreen state ───────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const handleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
          (document as Document & { webkitExitFullscreen: () => void }).webkitExitFullscreen();
        }
      } catch { /* ignore */ }
    } else {
      await playerRef.current?.enterFullscreen();
    }
    bumpOverlay();
  }, [isFullscreen, bumpOverlay]);

  // ── Portrait-on-mobile prompt (via hook) ──────────────────────────────────
  const isPortraitMobile = usePortraitMobile();

  // ── EPG: what's on now ────────────────────────────────────────────────────
  const nowPlaying = useCurrentEpg(channel?.id);

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-display font-medium tracking-widest text-lg text-white/50">TUNING IN...</p>
        </div>
      </div>
    );
  }

  if (isError || !channel) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Tv className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-4">Channel Unavailable</h1>
          <p className="text-muted-foreground mb-8 text-lg">We couldn't load this channel. It may be offline or removed.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 transition-all focus:ring-4 focus:ring-primary/50 outline-none">
            <ArrowLeft className="w-5 h-5" /> Return to Guide
          </Link>
        </div>
      </div>
    );
  }

  const isFav = isFavorite(channel.id);

  // Safe-area padding values (used inline to support env() properly)
  const safeTop    = "max(20px, env(safe-area-inset-top, 20px))";
  const safeBottom = "max(16px, env(safe-area-inset-bottom, 16px))";
  const safeLeft   = "max(16px, env(safe-area-inset-left, 16px))";
  const safeRight  = "max(16px, env(safe-area-inset-right, 16px))";

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden flex flex-col player-fullscreen"
      onClick={handlePlayerTap}
    >

      {/* ── Sleep-ended overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {sleepEnded && (
          <motion.div key="sleep-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-5">
              <Timer className="w-10 h-10 text-white/60" />
            </div>
            <h2 className="text-3xl font-display font-bold text-white mb-2">Sleep timer ended</h2>
            <p className="text-muted-foreground mb-8">Playback was paused automatically.</p>
            <div className="flex gap-3">
              <button onClick={() => { setSleepEnded(false); playerRef.current?.play(); }}
                className="min-h-[48px] px-7 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors">
                Resume
              </button>
              <Link href="/"
                className="min-h-[48px] flex items-center px-7 py-3 bg-secondary text-white rounded-xl font-bold hover:bg-secondary/80 transition-colors">
                Back to Guide
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TV Mode indicator ────────────────────────────────────────────────── */}
      {tvMode && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-violet-600/30 backdrop-blur-md border border-violet-500/40 text-violet-300 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full"
        >
          <MonitorPlay className="w-3.5 h-3.5" /> TV Mode · <span className="opacity-60">T to exit · Space to pause</span>
        </motion.div>
      )}

      {/* ── Portrait / fullscreen button (always visible on portrait mobile) ──── */}
      <AnimatePresence>
        {isPortraitMobile && !sleepEnded && (
          <motion.button
            key="rotate-prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={handleFullscreen}
            className="absolute bottom-[calc(env(safe-area-inset-bottom,16px)+72px)] left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-black/70 hover:bg-black/90 active:scale-95 backdrop-blur-md border border-white/10 hover:border-white/30 text-white/80 hover:text-white text-xs font-medium px-4 py-2.5 rounded-full transition-all min-h-[44px] cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Full screen
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Top overlay (tap anywhere to show/hide) ──────────────────────────── */}
      <div
        className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
          tvMode || showOverlay ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ paddingTop: safeTop, paddingLeft: safeLeft, paddingRight: safeRight, paddingBottom: "24px" }}
      >
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto w-full gap-3">

          {/* Back */}
          <Link href="/"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-white/90 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/50 shrink-0 min-h-[44px]">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-display font-bold hidden sm:block">Guide</span>
          </Link>

          {/* Channel info */}
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 min-w-0 flex-1">
            {channel.logo && (
              <img src={channel.logo} alt="" className="h-7 w-auto object-contain max-w-[48px] shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="text-white font-display font-bold text-sm md:text-base leading-none truncate">{channel.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {channel.isOnline && (
                  <span className="flex items-center gap-1 text-green-400 text-[10px] font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
                  </span>
                )}
                {channel.quality && (
                  <span className="text-white/50 text-[10px] font-bold">{channel.quality}</span>
                )}
                {sleepRemaining !== null && (
                  <span className="flex items-center gap-1 text-amber-400 text-[10px] font-bold">
                    <Timer className="w-3 h-3" /> {fmt(sleepRemaining)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons — all ≥ 44px touch target */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>

            {/* Stats */}
            <button
              onClick={() => { setShowStats((v) => !v); bumpOverlay(); }}
              title="Stream info"
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                showStats ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
              }`}>
              <Activity className="w-4 h-4" />
            </button>

            {/* Quality / Resolution selector */}
            {qualityLevels.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => { setQualityMenuOpen((v) => !v); setCaptionsMenuOpen(false); bumpOverlay(); }}
                  title="Video quality"
                  className={`min-w-[44px] min-h-[44px] flex items-center gap-1 px-2 rounded-full backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-primary text-xs font-bold ${
                    qualityMenuOpen ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
                  }`}>
                  <Gauge className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline leading-none">
                    {currentLevel === -1 ? "Auto" : (qualityLevels.find(l => l.index === currentLevel)?.label ?? "Auto")}
                  </span>
                </button>
                <AnimatePresence>
                  {qualityMenuOpen && (
                    <motion.div key="quality-menu"
                      initial={{ opacity: 0, scale: 0.9, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -6 }}
                      className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[140px]">
                      <div className="px-3 pt-2.5 pb-1">
                        <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Quality</p>
                      </div>
                      <button
                        onClick={() => { playerRef.current?.setQualityLevel(-1); setCurrentLevel(-1); setQualityMenuOpen(false); bumpOverlay(); }}
                        className={`flex items-center justify-between w-full px-4 py-3 text-sm transition-colors text-left min-h-[44px] ${
                          currentLevel === -1 ? "text-primary bg-primary/10 font-bold" : "text-white/80 hover:text-white hover:bg-white/5"
                        }`}>
                        Auto
                        {currentLevel === -1 && <span className="text-[10px] text-primary/70 font-normal">ABR</span>}
                      </button>
                      {[...qualityLevels].reverse().map((level) => (
                        <button key={level.index}
                          onClick={() => { playerRef.current?.setQualityLevel(level.index); setCurrentLevel(level.index); setQualityMenuOpen(false); bumpOverlay(); }}
                          className={`flex items-center justify-between w-full px-4 py-3 text-sm transition-colors text-left min-h-[44px] ${
                            currentLevel === level.index ? "text-primary bg-primary/10 font-bold" : "text-white/80 hover:text-white hover:bg-white/5"
                          }`}>
                          {level.label}
                          <span className="text-[10px] text-white/30 font-normal ml-2">{Math.round(level.bitrate / 1000)}k</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Captions / Subtitles */}
            <div className="relative">
              <button
                onClick={() => {
                  if (subtitleTracks.length === 0) {
                    // No tracks: toggle off/on via native video element
                    const video = document.querySelector("video");
                    if (video) {
                      const tracks = Array.from(video.textTracks);
                      const anyShowing = tracks.some(t => t.mode === "showing");
                      tracks.forEach(t => { t.mode = anyShowing ? "hidden" : "showing"; });
                    }
                    bumpOverlay();
                    return;
                  }
                  setCaptionsMenuOpen((v) => !v);
                  setQualityMenuOpen(false);
                  bumpOverlay();
                }}
                title={currentSubtitle >= 0 ? "Captions on" : "Captions off"}
                className={`min-w-[44px] min-h-[44px] flex items-center gap-1 px-2 rounded-full backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-primary text-xs font-bold ${
                  currentSubtitle >= 0 ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
                }`}>
                {currentSubtitle >= 0
                  ? <Captions className="w-4 h-4 shrink-0" />
                  : <CaptionsOff className="w-4 h-4 shrink-0" />
                }
                <span className="hidden sm:inline leading-none text-[10px]">CC</span>
              </button>
              <AnimatePresence>
                {captionsMenuOpen && subtitleTracks.length > 0 && (
                  <motion.div key="captions-menu"
                    initial={{ opacity: 0, scale: 0.9, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                    className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
                    <div className="px-3 pt-2.5 pb-1">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Captions</p>
                    </div>
                    <button
                      onClick={() => { playerRef.current?.setSubtitleTrack(-1); setCurrentSubtitle(-1); setCaptionsMenuOpen(false); bumpOverlay(); }}
                      className={`flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors text-left min-h-[44px] ${
                        currentSubtitle === -1 ? "text-primary bg-primary/10 font-bold" : "text-white/80 hover:text-white hover:bg-white/5"
                      }`}>
                      <CaptionsOff className="w-3.5 h-3.5" /> Off
                    </button>
                    {subtitleTracks.map((t) => (
                      <button key={t.id}
                        onClick={() => { playerRef.current?.setSubtitleTrack(t.id); setCurrentSubtitle(t.id); setCaptionsMenuOpen(false); bumpOverlay(); }}
                        className={`flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors text-left min-h-[44px] ${
                          currentSubtitle === t.id ? "text-primary bg-primary/10 font-bold" : "text-white/80 hover:text-white hover:bg-white/5"
                        }`}>
                        <Captions className="w-3.5 h-3.5" />
                        {t.name || t.lang || `Track ${t.id + 1}`}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PiP */}
            {pipSupported && (
              <button
                onClick={() => { handlePiP(); bumpOverlay(); }}
                title="Picture-in-Picture"
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  isPiP ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
                }`}>
                <PictureInPicture2 className="w-4 h-4" />
              </button>
            )}

            {/* Share */}
            <button
              onClick={() => { handleShare(); bumpOverlay(); }}
              title="Share channel link"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary">
              <Share2 className="w-4 h-4" />
            </button>

            {/* Fullscreen — always visible; rotates to landscape on mobile */}
            <button
              onClick={handleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen (landscape)"}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                isFullscreen
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
              }`}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Sleep timer */}
            <div className="relative">
              <button
                onClick={() => { setSleepMenuOpen((v) => !v); bumpOverlay(); }}
                title={sleepRemaining !== null ? `Sleep: ${fmt(sleepRemaining)}` : "Sleep timer"}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  sleepRemaining !== null
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
                }`}>
                <Timer className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {sleepMenuOpen && (
                  <motion.div key="sleep-menu"
                    initial={{ opacity: 0, scale: 0.9, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                    className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
                    <div className="px-3 pt-2.5 pb-1">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Sleep after</p>
                    </div>
                    {SLEEP_OPTIONS.map((mins) => (
                      <button key={mins} onClick={() => startSleepTimer(mins)}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors text-left min-h-[44px]">
                        <Timer className="w-3.5 h-3.5 text-amber-400" />
                        {mins} minutes
                      </button>
                    ))}
                    {sleepRemaining !== null && (
                      <button onClick={cancelSleep}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors border-t border-white/5 min-h-[44px]">
                        <X className="w-3.5 h-3.5" /> Cancel timer
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* TV Mode */}
            <button
              onClick={() => { setTvMode((v) => !v); bumpOverlay(); }}
              title="TV Mode (T)"
              className={`min-w-[44px] min-h-[44px] hidden sm:flex items-center justify-center rounded-full backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-violet-400 ${
                tvMode ? "bg-violet-600/30 text-violet-300 border border-violet-500/40" : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
              }`}>
              <MonitorPlay className="w-4 h-4" />
            </button>

            {/* Favorite */}
            <button
              onClick={() => { toggleFavorite(channel.id); bumpOverlay(); }}
              title="Favourite"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary">
              <Heart className={`w-4 h-4 ${isFav ? "fill-primary text-primary" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Now Playing bar ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {nowPlaying && (showOverlay || tvMode) && !sleepEnded && (
          <motion.div
            key="now-playing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="absolute left-0 right-0 z-40 pointer-events-none"
            style={{ bottom: safeBottom, paddingLeft: safeLeft, paddingRight: safeRight }}
          >
            <div className="max-w-screen-2xl mx-auto">
              <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 flex items-start gap-3">
                <Clapperboard className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm leading-tight truncate">
                      {nowPlaying.title}
                    </span>
                    {nowPlaying.category && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                        {nowPlaying.category}
                      </span>
                    )}
                    <span className="text-[10px] text-white/40 font-mono shrink-0">
                      until {new Date(nowPlaying.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {nowPlaying.description && (
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{nowPlaying.description}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stream stats panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showStats && stats && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            style={{ left: safeLeft, bottom: safeBottom }}
            className="absolute z-50 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-xs font-mono space-y-1.5 min-w-[200px]"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-green-400" />
              <span className="text-white/60 uppercase tracking-wider font-semibold text-[10px]">Stream Health</span>
              <button onClick={() => setShowStats(false)} className="ml-auto text-white/30 hover:text-white/70 min-w-[28px] min-h-[28px] flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
            <Stat label="Resolution" value={stats.resolution} />
            <Stat label="Bitrate"    value={`${stats.bitrate} kbps`} />
            <Stat label="Buffer"     value={`${stats.bufferLength}s`} color={stats.bufferLength > 5 ? "text-green-400" : "text-amber-400"} />
            <Stat label="Source"     value={`${stats.sourceIndex + 1} / ${stats.totalSources}`} />
            {stats.levelCount > 1 && (
              <Stat label="Quality levels" value={`${stats.levelCount}`} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main video ────────────────────────────────────────────────────────── */}
      <div className="flex-1 w-full h-full relative z-0">
        <VideoPlayer
          ref={playerRef}
          streamUrl={channel.streamUrl || null}
          streamUrls={channel.streamUrls || []}
          poster={channel.logo}
          onStatsUpdate={setStats}
          onQualityLevelsUpdate={(levels) => { setQualityLevels(levels); setCurrentLevel(levels.length > 0 ? levels[levels.length - 1].index : -1); }}
          onCurrentLevelUpdate={setCurrentLevel}
          onSubtitleTracksUpdate={setSubtitleTracks}
          onCurrentSubtitleUpdate={setCurrentSubtitle}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}
