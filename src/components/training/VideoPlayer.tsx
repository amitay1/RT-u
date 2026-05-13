import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrainingVideo } from "@/data/videoCatalog";
import { useVideoProgress } from "@/hooks/useVideoProgress";

interface VideoPlayerProps {
  video: TrainingVideo;
  onClose?: () => void;
  onWatchNext?: (nextVideoId: number) => void;
  autoPlay?: boolean;
}

/**
 * Plays a single training video with caption support and progress tracking.
 *
 * Falls back to a "Coming soon" placeholder when the video has not yet been
 * uploaded to the CDN (catalog entry has `videoUrl1080 === null`).
 */
export function VideoPlayer({
  video,
  onClose,
  onWatchNext,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { recordProgress, getProgress } = useVideoProgress();
  const [currentTime, setCurrentTime] = useState(0);

  // Resume from the last watched position.
  useEffect(() => {
    const saved = getProgress(video.id);
    if (saved && videoRef.current && saved.watchedSeconds < video.durationSeconds - 5) {
      videoRef.current.currentTime = saved.watchedSeconds;
    }
  }, [video.id, video.durationSeconds, getProgress]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    if (Math.floor(el.currentTime) % 5 === 0) {
      recordProgress(video.id, el.currentTime, video.durationSeconds);
    }
  };

  const handleEnded = () => {
    recordProgress(video.id, video.durationSeconds, video.durationSeconds);
  };

  const progressPercent =
    video.durationSeconds > 0
      ? Math.min(100, (currentTime / video.durationSeconds) * 100)
      : 0;

  const isPublished = video.videoUrl1080 !== null;

  return (
    <div className="flex flex-col gap-4">
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
            {...(Object.keys(video.captions).length > 0 ? { crossOrigin: "anonymous" as const } : {})}
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
        ) : (
          <PlaceholderState video={video} />
        )}
      </div>

      {/* Progress + actions */}
      {isPublished && (
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-1" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatTime(currentTime)} / {formatTime(video.durationSeconds)}
            </span>
            {video.nextId && onWatchNext && progressPercent > 90 && (
              <Button size="sm" variant="default" onClick={() => onWatchNext(video.nextId!)}>
                Watch next →
              </Button>
            )}
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
      <p className="text-xs text-slate-500">Expected duration: {formatTime(video.durationSeconds)}</p>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}
