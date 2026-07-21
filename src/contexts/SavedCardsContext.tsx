/**
 * Saved Cards Context
 * Manages saving, loading, and organizing RT/PT technique cards.
 * Cards are stored per profile - each profile sees only its own cards
 *
 * Uses unified storage to share data across all browsers (Chrome, Edge) and Electron
 */

import React, { createContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { decodeRtPtDocument } from '@/lib/rtPtDocumentCodec';
import {
  decodeStoredRtPtCards,
  importRtPtCardsFromJson,
  type RtPtCardImportReport,
  type RtPtSavedCard,
  type RtPtSavedCardsFilter,
} from '@/lib/rtPtSavedCard';
import { getStorageData, setStorageData, STORAGE_KEYS } from '@/services/unifiedStorage';

// Generate UUID using native crypto API
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Get current profile ID from localStorage
const getCurrentProfileId = (): string => {
  try {
    const stored = localStorage.getItem('rtpt_inspector_profiles');
    if (stored) {
      const data = JSON.parse(stored);
      return data.currentProfileId || 'default';
    }
  } catch (error) {
    console.error('Failed to get current profile:', error);
  }
  return 'default';
};

// ============================================================================
// TYPES
// ============================================================================

export type SavedCard = RtPtSavedCard;
export type SavedCardsFilter = RtPtSavedCardsFilter;
export type ImportCardsReport = RtPtCardImportReport;
export type SavedCardUpdate = Partial<Omit<SavedCard, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>>;

export interface SavedCardsContextType {
  // State
  cards: SavedCard[];
  isLoading: boolean;
  
  // CRUD operations
  saveCard: (card: Omit<SavedCard, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>) => SavedCard;
  updateCard: (id: string, updates: SavedCardUpdate) => void;
  deleteCard: (id: string) => void;
  duplicateCard: (id: string, newName?: string) => SavedCard | null;
  
  // Load/Get
  getCard: (id: string) => SavedCard | undefined;
  getFilteredCards: (filter?: SavedCardsFilter) => SavedCard[];
  
  // Favorites & Archive
  toggleFavorite: (id: string) => void;
  toggleArchive: (id: string) => void;
  
  // Tags
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  getAllTags: () => string[];
  
  // Import/Export
  exportCard: (id: string) => string | null;
  exportAllCards: () => string;
  importCards: (json: string) => ImportCardsReport;
  
  // Auto-save
  autoSaveCard: (id: string | null, cardData: Omit<SavedCard, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>) => string;
  
  // Recent cards
  getRecentCards: (limit?: number) => SavedCard[];
}

// ============================================================================
// CONTEXT
// ============================================================================

// This context remains public for the existing hook while its persistence provider stays co-located.
// eslint-disable-next-line react-refresh/only-export-components
export const SavedCardsContext = createContext<SavedCardsContextType | undefined>(undefined);

// ============================================================================
// STORAGE KEYS (using unified storage for cross-browser persistence)
// ============================================================================

const STORAGE_KEY = STORAGE_KEYS.SAVED_CARDS;

// ============================================================================
// PROVIDER
// ============================================================================

export function SavedCardsProvider({ children }: { children: ReactNode }) {
  const [allCards, setAllCards] = useState<SavedCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProfileId, setCurrentProfileId] = useState<string>(getCurrentProfileId());

  // Listen for profile changes
  useEffect(() => {
    const checkProfileChange = () => {
      const newProfileId = getCurrentProfileId();
      if (newProfileId !== currentProfileId) {
        setCurrentProfileId(newProfileId);
      }
    };

    // Check periodically for profile changes
    const interval = setInterval(checkProfileChange, 1000);
    
    // Also listen for storage events
    window.addEventListener('storage', checkProfileChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkProfileChange);
    };
  }, [currentProfileId]);

  // Filter cards by current profile
  const cards = allCards.filter(card => card.profileId === currentProfileId);

  // Ref to track if initial load is done
  const initialLoadDone = useRef(false);

  // Load cards from unified storage on mount
  useEffect(() => {
    const loadCards = async () => {
      try {
        const stored = await getStorageData<unknown>(STORAGE_KEY, []);
        const decoded = decodeStoredRtPtCards(stored, { fallbackProfileId: 'default' });
        setAllCards(decoded.cards);
        if (decoded.rejected > 0) {
          console.warn(
            `[RT-PT Saved Cards] Rejected ${decoded.rejected} invalid stored card(s).`,
            decoded.errors,
          );
        }
      } catch (error) {
        console.error('Failed to load saved cards:', error);
      } finally {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
    };

    loadCards();
  }, []);

  // Save cards to unified storage when they change
  useEffect(() => {
    // Only save after initial load is done to prevent overwriting
    if (!isLoading && initialLoadDone.current) {
      const saveCards = async () => {
        try {
          await setStorageData(STORAGE_KEY, allCards);
        } catch (error) {
          console.error('Failed to save cards:', error);
        }
      };

      saveCards();
    }
  }, [allCards, isLoading]);

  // Save a new card (with current profile)
  const saveCard = useCallback((cardData: Omit<SavedCard, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>): SavedCard => {
    const decoded = decodeRtPtDocument(cardData.data);
    if (decoded.status !== 'success') {
      throw new Error(`Cannot save this card: ${decoded.message}`);
    }
    const now = new Date().toISOString();
    const profileId = getCurrentProfileId();
    const newCard: SavedCard = {
      ...cardData,
      data: decoded.document,
      id: generateId(),
      profileId, // Associate with current profile
      createdAt: now,
      updatedAt: now,
    };
    
    setAllCards(prev => [newCard, ...prev]);
    return newCard;
  }, []);

  // Update existing card
  const updateCard = useCallback((id: string, updates: SavedCardUpdate) => {
    let safeUpdates = updates;
    if (Object.prototype.hasOwnProperty.call(updates, 'data')) {
      const decoded = decodeRtPtDocument(updates.data);
      if (decoded.status !== 'success') {
        throw new Error(`Cannot update this card: ${decoded.message}`);
      }
      safeUpdates = { ...updates, data: decoded.document };
    }
    setAllCards(prev => prev.map(card => 
      card.id === id 
        ? { ...card, ...safeUpdates, updatedAt: new Date().toISOString() }
        : card
    ));
  }, []);

  // Delete a card
  const deleteCard = useCallback((id: string) => {
    setAllCards(prev => prev.filter(card => card.id !== id));
  }, []);

  // Duplicate a card
  const duplicateCard = useCallback((id: string, newName?: string): SavedCard | null => {
    const original = allCards.find(c => c.id === id);
    if (!original) return null;
    
    const now = new Date().toISOString();
    const duplicated: SavedCard = {
      ...original,
      id: generateId(),
      name: newName || `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
    };
    
    setAllCards(prev => [duplicated, ...prev]);
    return duplicated;
  }, [allCards]);

  // Get single card
  const getCard = useCallback((id: string): SavedCard | undefined => {
    return cards.find(c => c.id === id);
  }, [cards]);

  // Get filtered cards
  const getFilteredCards = useCallback((filter?: SavedCardsFilter): SavedCard[] => {
    let result = [...cards];
    
    if (filter) {
      // Filter by RT/PT inspection method.
      if (filter.method && filter.method !== 'all') {
        result = result.filter(c => c.data.method === filter.method);
      }
      
      // Filter by search query
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        result = result.filter(c => 
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.tags.some(t => t.toLowerCase().includes(query))
        );
      }
      
      // Filter by tags
      if (filter.tags && filter.tags.length > 0) {
        result = result.filter(c => 
          filter.tags!.some(t => c.tags.includes(t))
        );
      }
      
      // Filter archived
      if (!filter.showArchived) {
        result = result.filter(c => !c.isArchived);
      }
      
      // Filter favorites
      if (filter.showFavoritesOnly) {
        result = result.filter(c => c.isFavorite);
      }
      
      // Sort
      const sortBy = filter.sortBy || 'updatedAt';
      const sortOrder = filter.sortOrder || 'desc';
      
      result.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'createdAt':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'updatedAt':
            comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case 'completionPercent':
            comparison = a.completionPercent - b.completionPercent;
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }
    
    return result;
  }, [cards]);

  // Toggle favorite
  const toggleFavorite = useCallback((id: string) => {
    setAllCards(prev => prev.map(card =>
      card.id === id ? { ...card, isFavorite: !card.isFavorite } : card
    ));
  }, []);

  // Toggle archive
  const toggleArchive = useCallback((id: string) => {
    setAllCards(prev => prev.map(card =>
      card.id === id ? { ...card, isArchived: !card.isArchived } : card
    ));
  }, []);

  // Add tag
  const addTag = useCallback((id: string, tag: string) => {
    setAllCards(prev => prev.map(card =>
      card.id === id && !card.tags.includes(tag)
        ? { ...card, tags: [...card.tags, tag], updatedAt: new Date().toISOString() }
        : card
    ));
  }, []);

  // Remove tag
  const removeTag = useCallback((id: string, tag: string) => {
    setAllCards(prev => prev.map(card =>
      card.id === id
        ? { ...card, tags: card.tags.filter(t => t !== tag), updatedAt: new Date().toISOString() }
        : card
    ));
  }, []);

  // Get all unique tags
  const getAllTags = useCallback((): string[] => {
    const allTags = cards.flatMap(c => c.tags);
    return [...new Set(allTags)].sort();
  }, [cards]);

  // Export single card
  const exportCard = useCallback((id: string): string | null => {
    const card = cards.find(c => c.id === id);
    if (!card) return null;
    return JSON.stringify(card, null, 2);
  }, [cards]);

  // Export all cards
  const exportAllCards = useCallback((): string => {
    return JSON.stringify(cards, null, 2);
  }, [cards]);

  // Import only RT/PT V1 documents, whether raw or inside an allowlisted old envelope.
  const importCards = useCallback((json: string): ImportCardsReport => {
    const report = importRtPtCardsFromJson(json, {
      profileId: getCurrentProfileId(),
      idFactory: generateId,
    });
    if (report.cards.length > 0) {
      setAllCards(prev => [...report.cards, ...prev]);
    }
    return {
      imported: report.imported,
      rejected: report.rejected,
      errors: report.errors,
    };
  }, []);

  // Auto-save (creates or updates based on existing ID)
  const autoSaveCard = useCallback((id: string | null, cardData: Omit<SavedCard, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>): string => {
    if (id) {
      // Update existing card
      const existing = cards.find(c => c.id === id);
      if (existing) {
        updateCard(id, cardData);
        return id;
      }
    }
    
    // Create new card
    const newCard = saveCard(cardData);
    return newCard.id;
  }, [cards, saveCard, updateCard]);

  // Get recent cards
  const getRecentCards = useCallback((limit: number = 5): SavedCard[] => {
    return [...cards]
      .filter(c => !c.isArchived)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }, [cards]);

  return (
    <SavedCardsContext.Provider
      value={{
        cards,
        isLoading,
        saveCard,
        updateCard,
        deleteCard,
        duplicateCard,
        getCard,
        getFilteredCards,
        toggleFavorite,
        toggleArchive,
        addTag,
        removeTag,
        getAllTags,
        exportCard,
        exportAllCards,
        importCards,
        autoSaveCard,
        getRecentCards,
      }}
    >
      {children}
    </SavedCardsContext.Provider>
  );
}
