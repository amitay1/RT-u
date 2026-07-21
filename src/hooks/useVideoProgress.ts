import { useCallback, useEffect, useState } from "react";

/**
 * Tracks which training videos the user has watched and how far through each one.
 *
 * Persisted in localStorage under "rtpt-inspector.video-progress.v1".
 * Future enhancement: sync to backend via React Query when the user is logged in.
 */

interface VideoProgress {
  /** Seconds watched (max across sessions). */
  watchedSeconds: number;
  /** True once the user reaches ≥95% of duration. */
  completed: boolean;
  /** Unix ms of the most recent view. */
  lastWatchedAt: number;
}

type ProgressMap = Record<number, VideoProgress>;

const STORAGE_KEY = "rtpt-inspector.video-progress.v1";

function readStorage(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

function writeStorage(map: ProgressMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage may be unavailable (private mode, quota) — silently no-op.
  }
}

export function useVideoProgress() {
  const [progress, setProgress] = useState<ProgressMap>(() => readStorage());

  useEffect(() => {
    writeStorage(progress);
  }, [progress]);

  const recordProgress = useCallback(
    (videoId: number, watchedSeconds: number, durationSeconds: number) => {
      setProgress((prev) => {
        const existing = prev[videoId];
        const nextWatched = Math.max(existing?.watchedSeconds ?? 0, watchedSeconds);
        const completed = durationSeconds > 0 && nextWatched / durationSeconds >= 0.95;
        return {
          ...prev,
          [videoId]: {
            watchedSeconds: nextWatched,
            completed,
            lastWatchedAt: Date.now(),
          },
        };
      });
    },
    []
  );

  const isCompleted = useCallback(
    (videoId: number) => Boolean(progress[videoId]?.completed),
    [progress]
  );

  const getProgress = useCallback(
    (videoId: number) => progress[videoId] ?? null,
    [progress]
  );

  const resetProgress = useCallback(() => setProgress({}), []);

  return { progress, recordProgress, isCompleted, getProgress, resetProgress };
}
