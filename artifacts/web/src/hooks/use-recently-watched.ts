import { useState, useCallback } from "react";

const STORAGE_KEY = "netstream_recently_watched";
const MAX_CHANNELS = 10;

export interface RecentChannel {
  id: string;
  name: string;
  logo?: string | null;
  quality?: string | null;
  country?: string | null;
  categories?: string[];
  watchedAt: number;
}

function load(): RecentChannel[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useRecentlyWatched() {
  const [recentChannels, setRecentChannels] = useState<RecentChannel[]>(load);

  const addRecent = useCallback((channel: Omit<RecentChannel, "watchedAt">) => {
    setRecentChannels((prev) => {
      const filtered = prev.filter((c) => c.id !== channel.id);
      const next = [{ ...channel, watchedAt: Date.now() }, ...filtered].slice(0, MAX_CHANNELS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const removeRecent = useCallback((id: string) => {
    setRecentChannels((prev) => {
      const next = prev.filter((c) => c.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setRecentChannels([]);
  }, []);

  return { recentChannels, addRecent, removeRecent, clearRecent };
}
