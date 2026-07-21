import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CollapsibleSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

/**
 * Collapsible Sidebar Component
 * Provides a sidebar that can be collapsed to save space
 */
export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  isOpen,
  onToggle,
  children,
  title,
  className
}) => {
  const contentId = React.useId();

  return (
    <div
      className={cn(
        'relative hidden h-full flex-shrink-0 transition-all duration-300 ease-in-out lg:flex',
        isOpen ? 'w-[clamp(252px,20vw,306px)]' : 'w-12',
        className
      )}
    >
      {/* Unmount hidden controls so they cannot remain in the keyboard tab order. */}
      {isOpen && (
        <div
          id={contentId}
          className="app-panel workbench-sidebar-shell flex h-full w-full min-w-0 flex-col overflow-hidden"
        >
          {title && (
            <div className="workbench-sidebar-title flex-shrink-0 border-b border-border/80 px-4 py-3.5 pr-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Technique workspace</p>
              <h3 className="mb-0 mt-1 text-base font-semibold tracking-tight">{title}</h3>
            </div>
          )}
          <ScrollArea className="min-h-0 flex-1">
            <div className="min-w-0 space-y-5 p-4">
              {children}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-label={isOpen ? 'Collapse technique sidebar' : 'Expand technique sidebar'}
        className={cn(
          'workbench-toggle-btn absolute top-3 z-20 h-9 w-9 rounded-lg border transition-colors duration-150 hover:bg-accent',
          isOpen ? '-right-4' : 'right-1.5'
        )}
        title={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};
