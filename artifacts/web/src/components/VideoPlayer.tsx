import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from "react";
import Hls from "hls.js";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface VideoPlayerHandle {
  pause: () => void;
  play: () => void;
  requestPiP: () => Promise<void>;
  enterFullscreen: () => Promise<void>;
  setQualityLevel: (levelIndex: number) => void;
  setSubtitleTrack: (trackId: number) => void;
}

export interface AudioTrackItem {
  id: number;
  name: string;
  lang: string;
}

export interface SubtitleTrackItem {
  id: number;
  name: string;
  lang: string;
}

export interface QualityLevelItem {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

export interface StreamStats {
  resolution: string;
  bitrate: number;
  bufferLength: number;
  sourceIndex: number;
  totalSources: number;
  levelIndex: number;
  levelCount: number;
}

interface VideoPlayerProps {
  streamUrl: string | null;
  streamUrls?: string[];
  poster?: string | null;
  onAudioTracksUpdate?: (tracks: AudioTrackItem[]) => void;
  onSubtitleTracksUpdate?: (tracks: SubtitleTrackItem[]) => void;
  onCurrentSubtitleUpdate?: (trackId: number) => void;
  onQualityLevelsUpdate?: (levels: QualityLevelItem[]) => void;
  onCurrentLevelUpdate?: (levelIndex: number) => void;
  onStatsUpdate?: (stats: StreamStats | null) => void;
}

function buildProxyUrl(rawUrl: string): string {
  return `/api/proxy/playlist?url=${encodeURIComponent(rawUrl)}`;
}

function dedupeUrls(primary: string | null, extras: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (url: string) => {
    if (url && !seen.has(url)) { seen.add(url); result.push(url); }
  };
  if (primary) add(primary);
  extras.forEach(add);
  return result;
}

function makeQualityLabel(height: number, bitrate: number): string {
  if (height >= 2160) return "4K";
  if (height >= 1080) return "1080p";
  if (height >= 720)  return "720p";
  if (height >= 576)  return "576p";
  if (height >= 480)  return "480p";
  if (height >= 360)  return "360p";
  if (height > 0)     return `${height}p`;
  return `${Math.round(bitrate / 1000)} kbps`;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      streamUrl, streamUrls = [], poster,
      onAudioTracksUpdate, onSubtitleTracksUpdate, onCurrentSubtitleUpdate,
      onQualityLevelsUpdate, onCurrentLevelUpdate, onStatsUpdate,
    },
    ref
  ) {
    const videoRef    = useRef<HTMLVideoElement>(null);
    const hlsRef      = useRef<Hls | null>(null);
    const statsTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

    const [error, setError]         = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [urlIndex, setUrlIndex]   = useState(0);
    const [audioTracks, setAudioTracks]     = useState<AudioTrackItem[]>([]);
    const [currentAudio, setCurrentAudio]   = useState(0);
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackItem[]>([]);
    const [currentSubtitle, setCurrentSubtitle] = useState(-1);

    const allUrls   = dedupeUrls(streamUrl, streamUrls);
    const totalUrls = allUrls.length;
    const urlsKey   = allUrls.join("|");

    useEffect(() => {
      setUrlIndex(0);
      setError(null);
      setIsLoading(true);
      setAudioTracks([]);
      setSubtitleTracks([]);
      setCurrentSubtitle(-1);
    }, [urlsKey]);

    useImperativeHandle(ref, () => ({
      pause: () => { videoRef.current?.pause(); },
      play:  () => { videoRef.current?.play().catch(() => {}); },
      requestPiP: async () => {
        const video = videoRef.current;
        if (!video || !document.pictureInPictureEnabled) return;
        if ((document as Document).pictureInPictureElement === video) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      },
      enterFullscreen: async () => {
        const container = videoRef.current?.closest(".player-fullscreen") as HTMLElement | null
          ?? videoRef.current?.parentElement;
        const video = videoRef.current;

        // 1. Standard Fullscreen API (Android Chrome, Desktop)
        try {
          if (container?.requestFullscreen) {
            await container.requestFullscreen();
            return;
          }
          if ((container as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })?.webkitRequestFullscreen) {
            await (container as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
            return;
          }
        } catch { /* may fail on iOS */ }

        // 2. iOS Safari fallback — native video fullscreen (auto-rotates to landscape)
        if (video && (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
          try {
            (video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
          } catch { /* ignore */ }
        }
      },
      setQualityLevel: (levelIndex: number) => {
        const hls = hlsRef.current;
        if (!hls) return;
        hls.currentLevel = levelIndex;
        onCurrentLevelUpdate?.(levelIndex);
      },
      setSubtitleTrack: (trackId: number) => {
        const hls = hlsRef.current;
        if (!hls) return;
        hls.subtitleTrack = trackId;
        setCurrentSubtitle(trackId);
        onCurrentSubtitleUpdate?.(trackId);
      },
    }), [onCurrentLevelUpdate, onCurrentSubtitleUpdate]);

    const startStatsPolling = useCallback(() => {
      if (statsTimer.current) clearInterval(statsTimer.current);
      statsTimer.current = setInterval(() => {
        const hls   = hlsRef.current;
        const video = videoRef.current;
        if (!hls || !video) return;
        const level  = hls.levels?.[hls.currentLevel];
        const buffEnd = video.buffered.length > 0
          ? video.buffered.end(video.buffered.length - 1) - video.currentTime
          : 0;
        onStatsUpdate?.({
          resolution:   level ? `${level.width}×${level.height}` : "—",
          bitrate:      level ? Math.round(level.bitrate / 1000) : 0,
          bufferLength: Math.max(0, Math.round(buffEnd)),
          sourceIndex:  urlIndex,
          totalSources: totalUrls,
          levelIndex:   hls.currentLevel ?? -1,
          levelCount:   hls.levels?.length ?? 0,
        });
      }, 2000);
    }, [urlIndex, totalUrls, onStatsUpdate]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (totalUrls === 0) {
        setError("No stream URL available for this channel.");
        setIsLoading(false);
        return;
      }

      const rawUrl = allUrls[urlIndex];
      if (!rawUrl) {
        setError("All stream sources failed. The channel may be offline or geo-blocked.");
        setIsLoading(false);
        return;
      }

      const proxyUrl = buildProxyUrl(rawUrl);
      setError(null);
      setIsLoading(true);

      if (statsTimer.current) { clearInterval(statsTimer.current); statsTimer.current = null; }
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

      let networkRetries = 0;
      const MAX_NETWORK_RETRIES = 3;

      const handlePlaying = () => setIsLoading(false);
      video.addEventListener("playing", handlePlaying);

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker:             true,
          lowLatencyMode:           false,
          backBufferLength:         30,
          maxBufferLength:          8,
          maxMaxBufferLength:       60,
          startFragPrefetch:        true,
          abrEwmaDefaultEstimate:   5_000_000,
          capLevelToPlayerSize:     false,      // allow user to pick any level
          fragLoadingMaxRetry:      2,
          manifestLoadingMaxRetry:  2,
          levelLoadingMaxRetry:     2,
        });

        hlsRef.current = hls;
        hls.loadSource(proxyUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
          // Start at highest quality level
          if (data.levels.length > 1) {
            hls.currentLevel = data.levels.length - 1;
          }

          // Emit quality levels to parent
          const levels: QualityLevelItem[] = data.levels.map((l, i) => ({
            index:   i,
            height:  l.height ?? 0,
            width:   l.width  ?? 0,
            bitrate: l.bitrate ?? 0,
            label:   makeQualityLabel(l.height ?? 0, l.bitrate ?? 0),
          }));
          onQualityLevelsUpdate?.(levels);
          onCurrentLevelUpdate?.(hls.currentLevel);

          setIsLoading(false);
          video.play().catch((e: unknown) => { console.warn("[VideoPlayer] Autoplay blocked:", e); });
          startStatsPolling();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
          onCurrentLevelUpdate?.(data.level);
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_evt, data) => {
          const tracks = data.audioTracks.map((t) => ({
            id: t.id, name: t.name || `Track ${t.id + 1}`, lang: t.lang || "",
          }));
          setAudioTracks(tracks);
          onAudioTracksUpdate?.(tracks);
        });
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_evt, data) => {
          setCurrentAudio(data.id);
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_evt, data) => {
          const tracks = data.subtitleTracks.map((t) => ({
            id: t.id, name: t.name || `Sub ${t.id + 1}`, lang: t.lang || "",
          }));
          setSubtitleTracks(tracks);
          onSubtitleTracksUpdate?.(tracks);
        });
        hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_evt, data) => {
          const id = data.id ?? -1;
          setCurrentSubtitle(id);
          onCurrentSubtitleUpdate?.(id);
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          console.error("[VideoPlayer] Fatal HLS error:", data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            networkRetries += 1;
            if (networkRetries <= MAX_NETWORK_RETRIES) { hls.startLoad(); return; }
          }
          hls.destroy();
          hlsRef.current = null;
          if (urlIndex + 1 < totalUrls) {
            setUrlIndex((i) => i + 1);
          } else {
            setError("All stream sources failed. The channel may be offline or geo-blocked.");
            setIsLoading(false);
            onStatsUpdate?.(null);
          }
        });

      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = proxyUrl;
        const handleMeta  = () => { setIsLoading(false); video.play().catch(() => {}); };
        const handleErr   = () => {
          if (urlIndex + 1 < totalUrls) { setUrlIndex((i) => i + 1); }
          else { setError("Failed to load stream."); setIsLoading(false); }
        };
        video.addEventListener("loadedmetadata", handleMeta);
        video.addEventListener("error", handleErr);
        return () => {
          video.removeEventListener("playing", handlePlaying);
          video.removeEventListener("loadedmetadata", handleMeta);
          video.removeEventListener("error", handleErr);
          video.src = "";
        };
      } else {
        setError("Your browser does not support HLS video streaming.");
        setIsLoading(false);
      }

      return () => {
        video.removeEventListener("playing", handlePlaying);
        if (statsTimer.current) { clearInterval(statsTimer.current); statsTimer.current = null; }
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      };
    }, [urlIndex, totalUrls, urlsKey]);

    const switchAudio    = (id: number) => { if (hlsRef.current) hlsRef.current.audioTrack = id; };
    const switchSubtitle = (id: number) => {
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = id;
        setCurrentSubtitle(id);
        onCurrentSubtitleUpdate?.(id);
      }
    };

    const handleRetry = () => { setError(null); setIsLoading(true); setUrlIndex(0); };

    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        <AnimatePresence>
          {isLoading && !error && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-white/70 font-medium font-display tracking-widest uppercase">
                Connecting{urlIndex > 0 ? ` (source ${urlIndex + 1})` : ""}...
              </p>
            </motion.div>
          )}
          {error && (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black p-8 text-center">
              <AlertCircle className="w-16 h-16 text-destructive mb-4" />
              <h2 className="text-2xl font-display font-bold text-white mb-2">Stream Error</h2>
              <p className="text-muted-foreground max-w-md mb-6">{error}</p>
              <button onClick={handleRetry}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 focus:ring-primary/50">
                <RefreshCw className="w-5 h-5" /> Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audio tracks — appear on hover, bottom-centre */}
        {audioTracks.length > 1 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none hover:pointer-events-auto">
            <div className="flex gap-1 bg-black/70 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10">
              <span className="text-[10px] text-white/40 uppercase tracking-wider self-center mr-1">🎵</span>
              {audioTracks.map((t) => (
                <button key={t.id} onClick={() => switchAudio(t.id)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${currentAudio === t.id ? "bg-primary text-white" : "text-white/60 hover:text-white"}`}>
                  {t.name || t.lang || `Track ${t.id + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain outline-none"
          controls
          playsInline
          webkit-playsinline="true"
          x-webkit-airplay="allow"
          poster={poster || undefined}
        />
      </div>
    );
  }
);
