/**
 * Saved Cards Dialog
 * UI for managing saved RT/PT technique cards.
 * Cards are filtered by profile - each profile sees only its own cards
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  FileText,
  Film,
  Monitor,
  Droplets,
  Star,
  StarOff,
  Archive,
  ArchiveRestore,
  Copy,
  Trash2,
  Download,
  Upload,
  MoreVertical,
  Clock,
  FolderOpen,
  SortAsc,
  SortDesc,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileCheck,
  ArrowRight,
  User,
} from 'lucide-react';
import { useSavedCards } from '@/hooks/useSavedCards';
import { SavedCard, SavedCardsFilter } from '@/contexts/SavedCardsContext';
import { useInspectorProfile } from '@/contexts/InspectorProfileContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { RtPtMethod } from '@/types/rtPtDocument';

// ============================================================================
// TYPES
// ============================================================================

interface SavedCardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadCard: (card: SavedCard) => void;
}

const METHOD_LABEL: Record<RtPtMethod, string> = {
  'RT-Film': 'Film RT',
  'RT-Digital': 'Digital RT',
  PT: 'PT',
};

const safeFilename = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'card'
);

// ============================================================================
// BEAUTIFUL CARD COMPONENT
// ============================================================================

function BeautifulCardItem({ 
  card, 
  onLoad, 
  onToggleFavorite,
  onToggleArchive,
  onDuplicate,
  onDelete,
  onExport,
}: {
  card: SavedCard;
  onLoad: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const method = card.data.method;
  const MethodIcon = method === 'RT-Film' ? Film : method === 'RT-Digital' ? Monitor : Droplets;
  const methodAccent = 'bg-primary';
  const methodIconClass = 'border border-primary/20 bg-primary/10 text-primary';

  const getCompletionColor = (percent: number) => {
    if (percent >= 80) return 'bg-success';
    if (percent >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  const getCompletionBg = (percent: number) => {
    if (percent >= 80) return 'border-success/30 bg-success/10';
    if (percent >= 50) return 'border-warning/30 bg-warning/10';
    return 'border-destructive/30 bg-destructive/10';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
        "transition-[border-color,box-shadow,opacity] duration-200 hover:border-primary/40 hover:shadow-md focus-within:border-primary/50",
        card.isArchived ? "border-border opacity-60" : "border-border",
        card.isFavorite && "border-warning/40"
      )}
      onClick={onLoad}
    >
      {/* Method Accent Line */}
      <div className={cn(
        "absolute inset-y-0 left-0 w-1",
        methodAccent,
      )} />

      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Type Icon */}
            <div className={cn(
              "flex-shrink-0 rounded-md p-2.5",
              methodIconClass,
            )}>
              <MethodIcon className="w-5 h-5" />
            </div>
            
            {/* Title & Description */}
            <div className="flex-1 min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-lg font-semibold leading-tight text-card-foreground">
                  {card.name}
                </h3>
                {card.isFavorite && (
                  <Star className="h-4 w-4 flex-none fill-warning text-warning" />
                )}
              </div>
              {card.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {card.description}
                </p>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-md border border-transparent text-muted-foreground opacity-70 transition-colors hover:border-border hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100"
                aria-label={`Actions for ${card.name}`}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border-border bg-popover text-popover-foreground">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLoad(); }}>
                <FolderOpen className="w-4 h-4 mr-2" />
                Open Card
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
                {card.isFavorite ? (
                  <>
                    <StarOff className="w-4 h-4 mr-2" />
                    Remove from Favorites
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 mr-2" />
                    Add to Favorites
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport(); }}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleArchive(); }}>
                {card.isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4 mr-2" />
                    Restore
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Progress Section */}
        <div className={cn(
          "mb-4 rounded-md border p-3.5",
          getCompletionBg(card.completionPercent)
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-sm text-foreground">
              {card.completionPercent >= 80 ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className={cn(
                  "h-4 w-4",
                  card.completionPercent >= 50 ? 'text-warning' : 'text-destructive',
                )} />
              )}
              Progress
            </span>
            <span className={cn(
              "text-lg font-semibold tabular-nums",
              card.completionPercent >= 80 ? 'text-success' :
              card.completionPercent >= 50 ? 'text-warning' : 'text-destructive'
            )}>
              {card.completionPercent}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${card.completionPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn("h-full rounded-sm", getCompletionColor(card.completionPercent))}
            />
          </div>
        </div>

        {/* Info Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground sm:gap-3">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(card.updatedAt)}
            </span>
            <Badge variant="outline" className="rounded-md border-border bg-muted/50 text-xs text-muted-foreground">
              {card.standard}
            </Badge>
            <Badge variant="outline" className="rounded-md border-primary/30 bg-primary/10 text-xs text-primary">
              {METHOD_LABEL[method]}
            </Badge>
          </div>
          
          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {card.tags.slice(0, 2).map(tag => (
                <Badge key={tag} variant="outline" className="rounded-md border-border bg-muted/40 text-xs text-muted-foreground">
                  {tag}
                </Badge>
              ))}
              {card.tags.length > 2 && (
                <Badge variant="outline" className="rounded-md border-border bg-muted/40 text-xs text-muted-foreground">
                  +{card.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Primary card action */}
        <motion.div className="mt-4 border-t border-border pt-4">
          <Button 
            className="w-full rounded-md gap-2"
            onClick={(e) => { e.stopPropagation(); onLoad(); }}
          >
            Open & Continue Editing
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

function EmptyState({ searchQuery, profileName }: { searchQuery: string; profileName?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-muted/50">
        <FolderOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {searchQuery ? 'No cards found' : 'No saved cards'}
      </h3>
      <p className="max-w-sm text-muted-foreground">
        {searchQuery 
          ? 'Try searching with different keywords' 
          : profileName 
            ? `Profile "${profileName}" has no saved cards yet`
            : 'Save your first card to continue working on it later'}
      </p>
      {!searchQuery && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" />
          Tip: Click the save button (💾) in the toolbar
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// MAIN DIALOG COMPONENT
// ============================================================================

export function SavedCardsDialog({ open, onOpenChange, onLoadCard }: SavedCardsDialogProps) {
  const { 
    cards, 
    getFilteredCards, 
    toggleFavorite, 
    toggleArchive, 
    duplicateCard, 
    deleteCard,
    exportCard,
    exportAllCards,
    importCards,
  } = useSavedCards();
  
  const { currentProfile } = useInspectorProfile();
  
  // State
  const [activeMethod, setActiveMethod] = useState<RtPtMethod | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'updatedAt' | 'name' | 'completionPercent'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Filter cards
  const filter: SavedCardsFilter = useMemo(() => ({
    method: activeMethod,
    searchQuery: searchQuery || undefined,
    showArchived,
    showFavoritesOnly,
    sortBy,
    sortOrder,
  }), [activeMethod, searchQuery, showArchived, showFavoritesOnly, sortBy, sortOrder]);
  
  const filteredCards = useMemo(() => getFilteredCards(filter), [getFilteredCards, filter]);
  
  // Stats
  const stats = useMemo(() => ({
    total: cards.filter(c => !c.isArchived).length,
    film: cards.filter(c => c.data.method === 'RT-Film' && !c.isArchived).length,
    digital: cards.filter(c => c.data.method === 'RT-Digital' && !c.isArchived).length,
    pt: cards.filter(c => c.data.method === 'PT' && !c.isArchived).length,
    favorites: cards.filter(c => c.isFavorite && !c.isArchived).length,
    archived: cards.filter(c => c.isArchived).length,
  }), [cards]);
  
  // Handlers
  const handleLoad = (card: SavedCard) => {
    onLoadCard(card);
    onOpenChange(false);
  };
  
  const handleDuplicate = (id: string) => {
    const newCard = duplicateCard(id);
    if (newCard) {
      toast.success(`Duplicated: "${newCard.name}"`);
    }
  };
  
  const handleDelete = (id: string) => {
    const card = cards.find(c => c.id === id);
    deleteCard(id);
    setDeleteConfirmId(null);
    toast.success(`Deleted: "${card?.name}"`);
  };
  
  const handleExport = (id: string) => {
    const json = exportCard(id);
    if (json) {
      const card = cards.find(c => c.id === id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rtpt-${safeFilename(card?.name || 'card')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('RT card exported successfully');
    }
  };
  
  const handleExportAll = () => {
    const json = exportAllCards();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rtpt-inspector-cards-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cards.length} cards`);
  };
  
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const json = e.target?.result as string;
          const report = importCards(json);
          const description = report.errors.slice(0, 3).join('\n');
          if (report.imported > 0 && report.rejected > 0) {
            toast.warning(
              `Imported ${report.imported} RT card(s); rejected ${report.rejected}.`,
              { description },
            );
          } else if (report.imported > 0) {
            toast.success(`Imported ${report.imported} RT card(s) successfully.`);
          } else {
            toast.error('No valid RT cards were imported.', { description });
          }
        };
        reader.onerror = () => {
          toast.error('Error reading file');
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] min-h-0 w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground shadow-xl sm:h-[min(880px,calc(100dvh-2rem))] sm:w-[calc(100vw-2rem)]">
          {/* Header */}
          <DialogHeader className="flex-none border-b border-border bg-card px-4 py-4 pr-12 text-left sm:px-6 sm:py-5 sm:pr-14">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-card-foreground sm:text-2xl">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  RT Saved Cards
                </DialogTitle>
                <DialogDescription className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {currentProfile && (
                    <>
                      <User className="w-4 h-4" />
                      <span className="font-medium text-foreground">{currentProfile.name}</span>
                      <span>•</span>
                    </>
                  )}
                  {stats.total} cards • {stats.film} Film RT • {stats.digital} Digital RT • {stats.pt} PT
                </DialogDescription>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                <div className="min-w-28 rounded-md border border-warning/25 bg-warning/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-warning" />
                    <span className="font-semibold tabular-nums text-warning">{stats.favorites}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Favorites</div>
                </div>
                <div className="min-w-28 rounded-md border border-success/25 bg-success/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-success" />
                    <span className="font-semibold tabular-nums text-success">
                      {cards.filter(c => c.completionPercent >= 80).length}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
              </div>
            </div>
          </DialogHeader>
          
          {/* Toolbar */}
          <div className="flex-none space-y-3 border-b border-border bg-muted/20 px-4 py-4 sm:px-6">
            {/* Search and Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[min(100%,16rem)] flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 rounded-md border-input bg-background pl-10 text-base text-foreground"
                />
              </div>
              
              <Button variant="outline" onClick={handleImport} className="h-10 rounded-md gap-2 bg-background">
                <Upload className="w-4 h-4" />
                Import
              </Button>
              
              <Button variant="outline" onClick={handleExportAll} className="h-10 rounded-md gap-2 bg-background" disabled={cards.length === 0}>
                <Download className="w-4 h-4" />
                Export All
              </Button>
            </div>
            
            {/* Tabs and Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Type Tabs */}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={activeMethod === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveMethod('all')}
                  className="rounded-md"
                >
                  All ({stats.total})
                </Button>
                <Button
                  variant={activeMethod === 'RT-Film' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveMethod('RT-Film')}
                  className="gap-1 rounded-md"
                >
                  <Film className="w-4 h-4" />
                  Film RT ({stats.film})
                </Button>
                <Button
                  variant={activeMethod === 'RT-Digital' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveMethod('RT-Digital')}
                  className="gap-1 rounded-md"
                >
                  <Monitor className="w-4 h-4" />
                  Digital RT ({stats.digital})
                </Button>
                <Button
                  variant={activeMethod === 'PT' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveMethod('PT')}
                  className="gap-1 rounded-md"
                >
                  <Droplets className="w-4 h-4" />
                  PT ({stats.pt})
                </Button>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant={showFavoritesOnly ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className="gap-1 rounded-md"
                >
                  <Star className={cn("w-4 h-4", showFavoritesOnly && "fill-warning text-warning")} />
                  Favorites
                </Button>
                
                <Button
                  variant={showArchived ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  className="gap-1 rounded-md"
                >
                  <Archive className="w-4 h-4" />
                  Archive ({stats.archived})
                </Button>
                
                <Separator orientation="vertical" className="h-6 mx-1" />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 rounded-md bg-background">
                      {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                      {sortBy === 'updatedAt' ? 'Date' : sortBy === 'name' ? 'Name' : 'Progress'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-border bg-popover text-popover-foreground">
                    <DropdownMenuItem onClick={() => setSortBy('updatedAt')}>
                      <Clock className="w-4 h-4 mr-2" />
                      Update Date
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('name')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Name
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('completionPercent')}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Completion %
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
                      {sortOrder === 'desc' ? <SortAsc className="w-4 h-4 mr-2" /> : <SortDesc className="w-4 h-4 mr-2" />}
                      {sortOrder === 'desc' ? 'Ascending' : 'Descending'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          
          {/* Cards Grid */}
          <ScrollArea className="min-h-0 flex-1 bg-background px-4 py-5 sm:px-6">
            <AnimatePresence mode="popLayout">
              {filteredCards.length === 0 ? (
                <EmptyState searchQuery={searchQuery} profileName={currentProfile?.name} />
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {filteredCards.map((card) => (
                    <BeautifulCardItem
                      key={card.id}
                      card={card}
                      onLoad={() => handleLoad(card)}
                      onToggleFavorite={() => toggleFavorite(card.id)}
                      onToggleArchive={() => toggleArchive(card.id)}
                      onDuplicate={() => handleDuplicate(card.id)}
                      onDelete={() => setDeleteConfirmId(card.id)}
                      onExport={() => handleExport(card.id)}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] rounded-lg border border-border bg-background text-foreground sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete this card?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. The card will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-md border-input bg-background text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
