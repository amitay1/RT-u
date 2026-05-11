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
  return (
    <div
      className={cn(
        'relative hidden h-full flex-shrink-0 transition-all duration-300 ease-in-out lg:flex',
        isOpen ? 'w-[clamp(252px,20vw,306px)]' : 'w-12',
        className
      )}
    >
      {/* Sidebar Content */}
      <div
        className={cn(
          'app-panel workbench-sidebar-shell flex h-full w-full min-w-0 flex-col overflow-hidden transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none w-0'
        )}
      >
        {title && (
          <div className="workbench-sidebar-title flex-shrink-0 border-b border-border/80 px-4 py-4 pr-12">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Control Deck</p>
            <h3 className="mt-1 font-semibold text-base mb-0">{title}</h3>
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1">
          <div className="min-w-0 space-y-5 p-4 pr-4">
            {children}
          </div>
        </ScrollArea>
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={cn(
          'workbench-toggle-btn absolute top-3 z-20 h-9 w-9 rounded-full shadow-sm hover:shadow-md transition-all duration-200',
          isOpen ? '-right-4' : 'right-2'
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
