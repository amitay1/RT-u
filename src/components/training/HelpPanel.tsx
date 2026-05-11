import { HelpCircle, PlayCircle, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getVideosForTab,
  getVideoById,
  ScanMasterTabId,
  TrainingVideo,
} from "@/data/videoCatalog";
import { useVideoProgress } from "@/hooks/useVideoProgress";

import { VideoPlayer } from "./VideoPlayer";

interface HelpPanelProps {
  /** Which Scan-Master tab the user is currently looking at. */
  tabId: ScanMasterTabId;
  /** Optional custom trigger button. Defaults to a small "?" icon. */
  trigger?: React.ReactNode;
}

/**
 * Floating help button + slide-out panel showing training videos relevant to
 * the current tab. Drop this into any tab component:
 *
 *     <HelpPanel tabId="CalibrationTab" />
 */
export function HelpPanel({ tabId, trigger }: HelpPanelProps) {
  const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
  const { isCompleted, getProgress } = useVideoProgress();

  const videos = useMemo(() => getVideosForTab(tabId), [tabId]);
  const activeVideo = activeVideoId ? getVideoById(activeVideoId) : null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            aria-label="Training videos for this tab"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {activeVideo ? (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveVideoId(null)}
              className="text-xs"
            >
              ← Back to video list
            </Button>
            <VideoPlayer
              video={activeVideo}
              autoPlay
              onWatchNext={(id) => setActiveVideoId(id)}
            />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Training videos</SheetTitle>
              <SheetDescription>
                {videos.length} video{videos.length === 1 ? "" : "s"} relevant to this tab. Click any
                to start watching.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-2">
              {videos.map((video) => (
                <VideoListItem
                  key={video.id}
                  video={video}
                  completed={isCompleted(video.id)}
                  progressSeconds={getProgress(video.id)?.watchedSeconds ?? 0}
                  onClick={() => setActiveVideoId(video.id)}
                />
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface VideoListItemProps {
  video: TrainingVideo;
  completed: boolean;
  progressSeconds: number;
  onClick: () => void;
}

function VideoListItem({ video, completed, progressSeconds, onClick }: VideoListItemProps) {
  const inProgress = progressSeconds > 0 && !completed;
  const isPublished = video.videoUrl1080 !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-lg border border-border/60 bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="mt-1 shrink-0">
        {completed ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <PlayCircle className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>S{video.series}</span>
          <span>·</span>
          <span>V{video.id}</span>
          {!isPublished && (
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[9px]">
              Coming soon
            </Badge>
          )}
          {inProgress && (
            <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[9px]">
              In progress
            </Badge>
          )}
        </div>
        <div className="truncate text-sm font-medium">{video.title}</div>
        <div className="line-clamp-2 text-xs text-muted-foreground">{video.description}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          {Math.round(video.durationSeconds / 60)} min
        </div>
      </div>
    </button>
  );
}
