import { useState, useEffect, useRef } from "react";

export interface EpgProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  category?: string | null;
}

export function useEpgBatch(channelIds: string[]): Record<string, EpgProgram> {
  const [programs, setPrograms] = useState<Record<string, EpgProgram>>({});
  const prevIdsRef = useRef<string>("");

  useEffect(() => {
    if (channelIds.length === 0) return;
    const key = channelIds.slice(0, 100).sort().join(",");
    if (key === prevIdsRef.current) return;
    prevIdsRef.current = key;

    const ids = channelIds.slice(0, 100).join(",");
    fetch(`/api/epg/now/batch?ids=${encodeURIComponent(ids)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.programs) setPrograms(data.programs);
      })
      .catch(() => {});
  }, [channelIds.slice(0, 100).join(",")]);

  return programs;
}
