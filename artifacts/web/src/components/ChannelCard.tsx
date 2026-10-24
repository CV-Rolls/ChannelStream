import { Heart, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetChannelQueryOptions } from "@workspace/api-client-react";
import type { Channel } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export type ViewMode = "large" | "grid" | "compact" | "list";

interface ChannelCardProps {
  channel: Channel;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  viewMode?: ViewMode;
  keyboardFocused?: boolean;
  epgProgram?: string | null;
  /** When explicitly provided: true = live event happening now (pulsing LIVE badge),
   *  false = stream online but no live event (steady Online badge).
   *  When omitted (undefined), falls back to channel.isOnline → "Live"/"Offline". */
  isLive?: boolean;
}

function StatusDot({ online, live = false }: { online: boolean; live?: boolean }) {
  if (!online) return <WifiOff className="w-3 h-3 text-red-400/70" />;
  return (
    <span className="relative flex h-2 w-2">
      {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
      <span className={cn("relative inline-flex rounded-full h-2 w-2", live ? "bg-green-500" : "bg-green-700")} />
    </span>
  );
}

export function ChannelCard({ channel, isFavorite, onToggleFavorite, viewMode = "grid", keyboardFocused = false, epgProgram, isLive }: ChannelCardProps) {
  const statusLabel = !channel.isOnline ? "Offline" : isLive === undefined ? "Live" : isLive ? "Live" : "Online";
  const statusLive  = channel.isOnline && (isLive === undefined || isLive === true);
  const queryClient = useQueryClient();
  const prefetch = () => queryClient.prefetchQuery(getGetChannelQueryOptions(channel.id));

  if (viewMode === "list") {
    return (
      <Link href={`/play/${channel.id}`} className="outline-none block">
        <div
          onMouseEnter={prefetch}
          onTouchStart={prefetch}
          className={cn(
            "group flex items-center gap-4 px-4 py-3 rounded-xl border bg-card/60 cursor-pointer outline-none focus:ring-2 focus:ring-primary/50 transition-colors hover:bg-white/5 hover:border-white/10",
            keyboardFocused ? "border-primary ring-2 ring-primary/60 bg-primary/5" : "border-white/5"
          )}
          tabIndex={0}
        >
          <div className="shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-secondary to-background flex items-center justify-center overflow-hidden border border-white/5">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt=""
                className="w-full h-full object-contain p-1.5"
                loading="eager"
                decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span className="text-xl font-display font-bold text-white/30">
                {channel.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-white truncate text-base">{channel.name}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {channel.categories.slice(0, 2).map(cat => (
                <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground capitalize">{cat}</span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {channel.quality && (
              <span className="hidden sm:block text-xs font-bold text-white/40 uppercase">{channel.quality}</span>
            )}
            <div className={cn("flex items-center gap-1 text-[11px] font-bold uppercase", !channel.isOnline ? "text-red-400/60" : statusLive ? "text-green-400" : "text-green-600")}>
              <StatusDot online={channel.isOnline} live={statusLive} />
              <span className="hidden sm:inline">{statusLabel}</span>
            </div>
            <button
              onClick={onToggleFavorite}
              className={cn(
                "p-1.5 rounded-full transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary",
                isFavorite ? "text-primary" : "text-white/30"
              )}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
            </button>
          </div>
        </div>
      </Link>
    );
  }

  if (viewMode === "compact") {
    return (
      <Link href={`/play/${channel.id}`} className="outline-none block">
        <div
          onMouseEnter={prefetch}
          onTouchStart={prefetch}
          className={cn(
            "group relative cursor-pointer outline-none rounded-xl bg-card border overflow-hidden shadow-md focus:ring-2 focus:ring-primary/50 aspect-square flex items-center justify-center transition-transform duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95",
            keyboardFocused ? "border-primary ring-2 ring-primary/60 shadow-primary/20" : "border-card-border"
          )}
          tabIndex={0}
        >
          {!channel.isOnline && <div className="absolute inset-0 bg-black/40 z-10" />}

          <div className="absolute top-2 left-2 z-20">
            <StatusDot online={channel.isOnline} live={statusLive} />
          </div>

          {channel.quality && (
            <div className="absolute top-2 right-2 z-20 text-[8px] font-bold text-white/50 uppercase bg-black/40 px-1 py-0.5 rounded">
              {channel.quality}
            </div>
          )}

          <div className="w-full h-full bg-gradient-to-br from-secondary to-background p-3 flex items-center justify-center">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt=""
                className="max-h-full max-w-full object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-110"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <div className={cn("text-2xl font-display font-bold text-white/20 text-center", channel.logo ? "hidden" : "block")}>
              {channel.name.substring(0, 2).toUpperCase()}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200 z-20">
            <p className="text-white text-[10px] font-semibold truncate text-center">{channel.name}</p>
          </div>

          <button
            onClick={onToggleFavorite}
            className={cn(
              "absolute bottom-2 right-2 z-30 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
              isFavorite ? "text-primary opacity-100" : "text-white/70"
            )}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("w-3 h-3", isFavorite && "fill-current")} />
          </button>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/play/${channel.id}`} className="outline-none block">
      <div
        onMouseEnter={prefetch}
        onTouchStart={prefetch}
        className={cn(
          "group relative flex flex-col cursor-pointer outline-none rounded-2xl bg-card border overflow-hidden shadow-lg transition-all duration-200 focus:ring-4 focus:ring-primary/50 hover:scale-[1.03] hover:-translate-y-1 active:scale-[0.98]",
          keyboardFocused ? "border-primary ring-4 ring-primary/50 shadow-primary/20 -translate-y-1" : "border-card-border"
        )}
        tabIndex={0}
      >
        <div className="relative w-full aspect-video bg-gradient-to-br from-secondary to-background p-6 flex items-center justify-center overflow-hidden">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider">
            <StatusDot online={channel.isOnline} live={statusLive} />
            <span className={!channel.isOnline ? "text-red-400" : statusLive ? "text-green-400" : "text-green-600/80"}>
              {statusLabel}
            </span>
          </div>

          {channel.quality && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-white/10 backdrop-blur-md border border-white/5 text-[10px] font-bold text-white uppercase tracking-wider">
              {channel.quality}
            </div>
          )}

          <button
            onClick={onToggleFavorite}
            className={cn(
              "absolute bottom-3 right-3 p-2 rounded-full backdrop-blur-md transition-all z-10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-primary",
              isFavorite ? "bg-primary/20 text-primary" : "bg-black/40 text-white/70"
            )}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </button>

          {channel.logo ? (
            <img
              src={channel.logo}
              alt={`${channel.name} logo`}
              className="max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110"
              loading="eager"
              decoding="async"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={cn("text-3xl font-display font-bold text-white/30 text-center", channel.logo ? "hidden" : "block")}>
            {channel.name.substring(0, 2).toUpperCase()}
          </div>
        </div>

        <div className="p-2.5 sm:p-4 border-t border-white/5 bg-black/20">
          <h3 className="text-xs sm:text-base font-display font-semibold text-white truncate leading-tight">{channel.name}</h3>
          {epgProgram && (
            <p className="text-[10px] text-primary/80 mt-0.5 sm:mt-1 truncate flex items-center gap-1">
              <span className="text-primary">▶</span> {epgProgram}
            </p>
          )}
          <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
            {channel.categories.slice(0, 1).map(cat => (
              <span key={cat} className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground capitalize">{cat}</span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
