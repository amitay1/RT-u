import { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrainingVideo } from "@/data/videoCatalog";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Gauge, List, Download, Keyboard } from "lucide-react";

interface VideoPlayerProps {
  video: TrainingVideo;
  onClose?: () => void;
  onWatchNext?: (nextVideoId: number) => void;
  autoPlay?: boolean;
}

interface Chapter {
  start: number;
  end: number;
  title: string;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/**
 * Plays a single training video with caption support, chapter navigation,
 * playback-speed control, keyboard shortcuts and progress tracking.
 *
 * Falls back to a "Coming soon" placeholder when the video has not yet been
 * uploaded to the CDN (catalog entry has `videoUrl1080 === null`).
 *
 * Keyboard shortcuts (active when player is focused or hovered):
 *   Space / K       Play / Pause
 *   J  /  L         Skip back / forward 10 s
 *   ←  /  →         Skip back / forward 5 s
 *   ,  /  .         Previous / next chapter
 *   M               Mute toggle
 *   F               Fullscreen toggle
 *   C               Toggle captions
 *   0 – 9           Jump to 0-90 % of video
 */
export function VideoPlayer({
  video,
  onClose,
  onWatchNext,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { recordProgress, getProgress } = useVideoProgress();
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);

  // Latest progress accessor — read via ref so the seek-on-mount effect
  // below isn't a dependency on the constantly-changing `getProgress`
  // callback. Otherwise every recordProgress() (fired every ~5s) would
  // re-run the effect and re-seek the player mid-playback.
  const getProgressRef = useRef(getProgress);
  getProgressRef.current = getProgress;
  const lastRecordedAtRef = useRef(0);

  // Resume from the last watched position — but only if the user actually
  // got meaningfully into the video. Otherwise default to 0 so first-time
  // viewers (and anyone who just opened/closed the player) get a fresh start.
  const RESUME_MIN_SECONDS = 30;
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const applyResume = () => {
      const saved = getProgressRef.current(video.id);
      const within =
        saved &&
        saved.watchedSeconds >= RESUME_MIN_SECONDS &&
        saved.watchedSeconds < video.durationSeconds - 5;
      if (within) el.currentTime = saved!.watchedSeconds;
    };
    if (el.readyState >= 1) applyResume();
    else el.addEventListener("loadedmetadata", applyResume, { once: true });
    return () => el.removeEventListener("loadedmetadata", applyResume);
  }, [video.id, video.durationSeconds]);

  // Load chapters from the chapters VTT file if provided.
  useEffect(() => {
    if (!video.chaptersUrl) {
      setChapters([]);
      return;
    }
    let cancelled = false;
    fetch(video.chaptersUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => {
        if (cancelled) return;
        setChapters(parseChaptersVTT(text));
      })
      .catch((err) => {
        if (!cancelled) console.warn("Failed to load chapters:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [video.chaptersUrl]);

  // Apply playback rate to the <video> element whenever it changes.
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.playbackRate = playbackRate;
  }, [playbackRate]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    // Throttle: write at most once every 5s (timeupdate fires ~4×/s).
    const now = performance.now();
    if (now - lastRecordedAtRef.current >= 5000) {
      lastRecordedAtRef.current = now;
      recordProgress(video.id, el.currentTime, video.durationSeconds);
    }
  };

  const handleEnded = () => {
    recordProgress(video.id, video.durationSeconds, video.durationSeconds);
  };

  // ── Keyboard shortcuts ──
  // We attach to the container; the user must focus the player area first
  // (clicking it or tabbing to it) so we don't hijack global shortcuts.
  const seekBy = useCallback((deltaSeconds: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(
      0,
      Math.min(video.durationSeconds, el.currentTime + deltaSeconds)
    );
  }, [video.durationSeconds]);

  const seekTo = useCallback((t: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(video.durationSeconds, t));
  }, [video.durationSeconds]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (el) el.muted = !el.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const goToChapter = useCallback(
    (direction: 1 | -1) => {
      if (chapters.length === 0) return;
      const el = videoRef.current;
      if (!el) return;
      const now = el.currentTime;
      if (direction === 1) {
        const next = chapters.find((c) => c.start > now + 0.5);
        if (next) el.currentTime = next.start;
      } else {
        // Previous: if we are >3s into a chapter, restart it; otherwise jump to previous
        const currentIdx = chapters.findIndex(
          (c) => now >= c.start && now < c.end
        );
        if (currentIdx === -1) return;
        if (now - chapters[currentIdx].start > 3) {
          el.currentTime = chapters[currentIdx].start;
        } else if (currentIdx > 0) {
          el.currentTime = chapters[currentIdx - 1].start;
        }
      }
    },
    [chapters]
  );

  const toggleCaptions = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const enabling = !captionsEnabled;
    setCaptionsEnabled(enabling);
    for (let i = 0; i < el.textTracks.length; i++) {
      const t = el.textTracks[i];
      if (t.kind === "subtitles" || t.kind === "captions") {
        t.mode = enabling ? "showing" : "hidden";
      }
    }
  }, [captionsEnabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore if user is typing somewhere
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
          e.preventDefault();
          seekBy(-10);
          break;
        case "l":
          e.preventDefault();
          seekBy(10);
          break;
        case "arrowleft":
          e.preventDefault();
          seekBy(-5);
          break;
        case "arrowright":
          e.preventDefault();
          seekBy(5);
          break;
        case ",":
          e.preventDefault();
          goToChapter(-1);
          break;
        case ".":
          e.preventDefault();
          goToChapter(1);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "c":
          e.preventDefault();
          toggleCaptions();
          break;
        default:
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const pct = parseInt(e.key, 10) / 10;
            seekTo(video.durationSeconds * pct);
          }
      }
    };
    container.addEventListener("keydown", onKey);
    return () => container.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    seekBy,
    seekTo,
    goToChapter,
    toggleMute,
    toggleFullscreen,
    toggleCaptions,
    video.durationSeconds,
  ]);

  const progressPercent =
    video.durationSeconds > 0
      ? Math.min(100, (currentTime / video.durationSeconds) * 100)
      : 0;

  const isPublished = video.videoUrl1080 !== null;

  const currentChapter = chapters.find(
    (c) => currentTime >= c.start && currentTime < c.end
  );

  return (
    <div className="flex flex-col gap-4" ref={containerRef} tabIndex={-1}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Series {video.series}</Badge>
            <span>{video.seriesTitle}</span>
            {video.id <= 28 && (
              <>
                <span>·</span>
                <span>Video {video.id} of 28</span>
              </>
            )}
          </div>
          <h2 className="mt-1 text-xl font-semibold leading-tight">{video.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{video.description}</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close player">
            ✕
          </Button>
        )}
      </div>

      {/* Player area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {isPublished ? (
          <>
            <video
              ref={videoRef}
              src={video.videoUrl1080 ?? undefined}
              poster={video.thumbnailUrl ?? undefined}
              controls
              autoPlay={autoPlay}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              className="h-full w-full"
              // crossOrigin only needed when external <track> elements are loaded
              // from a CORS-protected URL. Setting it for the video itself breaks
              // playback of locally-served files (no Access-Control-Allow-Origin).
              {...(Object.keys(video.captions).length > 0
                ? { crossOrigin: "anonymous" as const }
                : {})}
            >
              {Object.entries(video.captions).map(([lang, url]) => (
                <track
                  key={lang}
                  kind="subtitles"
                  srcLang={lang}
                  src={url}
                  label={lang.toUpperCase()}
                  default={lang === "en"}
                />
              ))}
            </video>
            {/* Current chapter badge overlay (top-left) */}
            {currentChapter && (
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
                {currentChapter.title}
              </div>
            )}
          </>
        ) : (
          <PlaceholderState video={video} />
        )}
      </div>

      {/* Progress + actions */}
      {isPublished && (
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-1" />

          {/* Chapter markers row */}
          {chapters.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chapters.map((c, i) => {
                const isActive =
                  currentTime >= c.start && currentTime < c.end;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => seekTo(c.start)}
                    className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${
                      isActive
                        ? "border-cyan-500 bg-cyan-500/20 font-medium text-cyan-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                    title={`${formatTime(c.start)} — ${c.title}`}
                  >
                    {i + 1}. {c.title}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatTime(currentTime)} / {formatTime(video.durationSeconds)}
            </span>

            <div className="flex items-center gap-2">
              {/* Playback rate */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    title="Playback speed"
                  >
                    <Gauge className="h-3 w-3" />
                    {playbackRate}×
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-1" align="end">
                  <div className="flex flex-col">
                    {PLAYBACK_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setPlaybackRate(rate)}
                        className={`rounded px-2 py-1 text-left text-xs hover:bg-slate-100 ${
                          rate === playbackRate ? "bg-slate-100 font-medium" : ""
                        }`}
                      >
                        {rate}×{rate === 1 ? " (Normal)" : ""}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Chapter list */}
              {chapters.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      title="Jump to chapter"
                    >
                      <List className="h-3 w-3" />
                      Chapters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-1" align="end">
                    <div className="flex flex-col">
                      {chapters.map((c, i) => {
                        const isActive =
                          currentTime >= c.start && currentTime < c.end;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => seekTo(c.start)}
                            className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-slate-100 ${
                              isActive ? "bg-cyan-50 font-medium" : ""
                            }`}
                          >
                            <span className="truncate">
                              {i + 1}. {c.title}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatTime(c.start)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Download transcript */}
              {video.captions.en && (
                <a
                  href={video.captions.en}
                  download
                  className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs hover:bg-slate-100"
                  title="Download English transcript (.vtt)"
                >
                  <Download className="h-3 w-3" />
                  Transcript
                </a>
              )}

              {/* Keyboard shortcuts help */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    title="Keyboard shortcuts"
                  >
                    <Keyboard className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 text-xs" align="end">
                  <p className="mb-2 font-medium">Keyboard shortcuts</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="font-mono">Space / K</dt>
                    <dd>Play / Pause</dd>
                    <dt className="font-mono">J / L</dt>
                    <dd>−10 s / +10 s</dd>
                    <dt className="font-mono">← / →</dt>
                    <dd>−5 s / +5 s</dd>
                    <dt className="font-mono">, / .</dt>
                    <dd>Previous / Next chapter</dd>
                    <dt className="font-mono">0 – 9</dt>
                    <dd>Jump to 0-90 %</dd>
                    <dt className="font-mono">M</dt>
                    <dd>Mute</dd>
                    <dt className="font-mono">F</dt>
                    <dd>Fullscreen</dd>
                    <dt className="font-mono">C</dt>
                    <dd>Toggle captions</dd>
                  </dl>
                </PopoverContent>
              </Popover>

              {video.nextId && onWatchNext && progressPercent > 90 && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onWatchNext(video.nextId!)}
                >
                  Watch next →
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Concept tags */}
      {video.concepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {video.concepts.map((c) => (
            <Badge key={c} variant="outline" className="text-[10px]">
              {c}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderState({ video }: { video: TrainingVideo }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-center text-slate-200">
      <div className="text-4xl">🎬</div>
      <h3 className="text-lg font-semibold">Coming soon</h3>
      <p className="max-w-md text-sm text-slate-400">
        This video is in production. The full curriculum and scripts are ready —
        production timeline ~6 weeks for all 28 videos.
      </p>
      <p className="text-xs text-slate-500">
        Expected duration: {formatTime(video.durationSeconds)}
      </p>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

/**
 * Parse a minimal WebVTT chapters file.
 * Format expected:
 *   WEBVTT
 *
 *   Chapter 1
 *   00:00:00.000 --> 00:00:10.840
 *   Introduction
 *
 *   Chapter 2
 *   ...
 *
 * We ignore the identifier line, parse the timestamp line, and take the
 * following non-empty line as the chapter title.
 */
function parseChaptersVTT(text: string): Chapter[] {
  const chapters: Chapter[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(
      /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );
    if (!m) continue;
    const start =
      +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
    const end =
      +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000;
    // Title is the next non-empty line
    let title = "";
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t.length === 0) break;
      title = title ? `${title} ${t}` : t;
    }
    if (title) chapters.push({ start, end, title });
  }
  return chapters;
}
