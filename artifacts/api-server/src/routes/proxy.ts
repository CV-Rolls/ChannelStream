import { Router, type IRouter, type Request, type Response } from "express";
import { URL } from "node:url";

const router: IRouter = Router();

function isPrivateOrReserved(hostname: string): boolean {
  let h = hostname.toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) {
    h = h.slice(1, -1);
  }

  if (h === "localhost" || h === "localhost.") return true;

  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^0\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (h === "169.254.169.254") return true;

  if (h === "::1" || h === "::" || h === "0000::1") return true;
  if (/^fe80:/i.test(h)) return true;
  if (/^fd[0-9a-f]{2}:/i.test(h)) return true;
  if (/^fc[0-9a-f]{2}:/i.test(h)) return true;
  if (/^::ffff:/i.test(h)) return true;

  // Cloud metadata endpoints
  if (/^metadata\.google/i.test(h)) return true;           // GCP
  if (/^169\.254\.169\.254$/.test(h)) return true;          // AWS / Azure IMDS
  if (/^fd00:ec2::254$/.test(h)) return true;              // AWS IPv6 IMDS
  if (/^metadata\.azure\.com$/i.test(h)) return true;      // Azure
  if (/^100\.100\.100\.200$/.test(h)) return true;         // Alibaba Cloud IMDS

  return false;
}

function isUrlAllowed(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;
    if (isPrivateOrReserved(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

const PROXY_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Origin, Accept",
  "Cache-Control": "no-cache, no-store",
};

const UPSTREAM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
};

function resolveAbsoluteUrl(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function isPlaylistUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".m3u8") || path.endsWith(".m3u");
}

function buildProxyPlaylistUrl(req: Request, targetUrl: string): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}/api/proxy/playlist?url=${encodeURIComponent(targetUrl)}`;
}

function buildProxySegmentUrl(req: Request, targetUrl: string): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}/api/proxy/segment?url=${encodeURIComponent(targetUrl)}`;
}

function rewritePlaylist(content: string, baseUrl: string, req: Request): string {
  const lines = content.split("\n");
  return lines
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
          const absolute = resolveAbsoluteUrl(uri, baseUrl);
          const proxied = isPlaylistUrl(absolute)
            ? buildProxyPlaylistUrl(req, absolute)
            : buildProxySegmentUrl(req, absolute);
          return `URI="${proxied}"`;
        });
      }

      const absolute = resolveAbsoluteUrl(trimmed, baseUrl);
      return isPlaylistUrl(absolute)
        ? buildProxyPlaylistUrl(req, absolute)
        : buildProxySegmentUrl(req, absolute);
    })
    .join("\n");
}

router.get("/proxy/playlist", async (req: Request, res: Response): Promise<void> => {
  const rawUrl = req.query["url"];
  if (typeof rawUrl !== "string" || !rawUrl) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  const targetUrl = rawUrl;

  if (!isUrlAllowed(targetUrl)) {
    res.status(403).json({ error: "URL not allowed" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let finalUrl = targetUrl;
    let upstream: globalThis.Response | null = null;
    for (let redirects = 0; redirects < 5; redirects++) {
      upstream = await fetch(finalUrl, {
        headers: UPSTREAM_HEADERS,
        redirect: "manual",
        signal: controller.signal,
      });
      const location = upstream.headers.get("location");
      if (location && [301, 302, 303, 307, 308].includes(upstream.status)) {
        const resolved = resolveAbsoluteUrl(location, finalUrl);
        if (!isUrlAllowed(resolved)) {
          clearTimeout(timeout);
          res.status(403).json({ error: "Redirect target not allowed" });
          return;
        }
        finalUrl = resolved;
        continue;
      }
      break;
    }

    clearTimeout(timeout);

    if (!upstream || !upstream.ok) {
      res.status(upstream?.status || 502).json({ error: `Upstream returned ${upstream?.status || "no response"}` });
      return;
    }

    // Playlist files are text — anything >1 MB is suspicious
    const MAX_PLAYLIST_BYTES = 1_048_576;
    const contentLength = upstream.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_PLAYLIST_BYTES) {
      res.status(413).json({ error: "Playlist response too large" });
      return;
    }

    const content = await upstream.text();
    if (Buffer.byteLength(content) > MAX_PLAYLIST_BYTES) {
      res.status(413).json({ error: "Playlist response too large" });
      return;
    }
    const rewritten = rewritePlaylist(content, finalUrl, req);

    Object.entries(PROXY_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(rewritten);
  } catch (err) {
    console.error("[proxy] Playlist fetch error:", err);
    res.status(502).json({ error: "Failed to fetch playlist from upstream" });
  }
});

// Segment proxy: HLS.js fetches segments via JavaScript (fetch/XHR) which
// enforces CORS. Most IPTV CDNs do not send CORS headers because they are
// designed for native players, not JS-based ones. The proxy adds the required
// CORS headers and pipes the bytes through. SSRF protection applies before
// any data is fetched.
router.get("/proxy/segment", async (req: Request, res: Response): Promise<void> => {
  const rawUrl = req.query["url"];
  if (typeof rawUrl !== "string" || !rawUrl) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  const targetUrl = rawUrl;

  if (!isUrlAllowed(targetUrl)) {
    res.status(403).json({ error: "URL not allowed" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const upstreamHeaders: Record<string, string> = { ...UPSTREAM_HEADERS };
    if (req.headers["range"]) {
      upstreamHeaders["Range"] = req.headers["range"];
    }

    let finalUrl = targetUrl;
    let upstream: globalThis.Response | null = null;
    for (let redirects = 0; redirects < 5; redirects++) {
      upstream = await fetch(finalUrl, {
        headers: upstreamHeaders,
        redirect: "manual",
        signal: controller.signal,
      });
      const location = upstream.headers.get("location");
      if (location && [301, 302, 303, 307, 308].includes(upstream.status)) {
        const resolved = resolveAbsoluteUrl(location, finalUrl);
        if (!isUrlAllowed(resolved)) {
          clearTimeout(timeout);
          res.status(403).json({ error: "Redirect target not allowed" });
          return;
        }
        finalUrl = resolved;
        continue;
      }
      break;
    }

    clearTimeout(timeout);

    if (!upstream || (!upstream.ok && upstream.status !== 206)) {
      res.status(upstream?.status || 502).end();
      return;
    }

    Object.entries(PROXY_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

    const contentType = upstream.headers.get("content-type") || "video/mp2t";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    res.status(upstream.status);

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const MAX_SEGMENT_BYTES = 64 * 1_048_576; // 64 MB cap — well above any real TS segment
    let bytesReceived = 0;
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesReceived += value?.byteLength ?? 0;
        if (bytesReceived > MAX_SEGMENT_BYTES) {
          reader.cancel().catch(() => undefined);
          if (!res.writableEnded) res.end();
          return;
        }
        if (!res.writableEnded) res.write(value);
      }
      if (!res.writableEnded) res.end();
    };

    pump().catch((err) => {
      console.error("[proxy] Segment pipe error:", err);
      if (!res.writableEnded) res.end();
    });
  } catch (err) {
    console.error("[proxy] Segment fetch error:", err);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to fetch segment from upstream" });
    }
  }
});

export default router;
