import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { logError } from "@/lib/logger";
import type { SavedCard } from "@/contexts/SavedCardsContext";
import { useSavedCards } from "@/hooks/useSavedCards";
import { decodeRtPtDocument } from "@/lib/rtPtDocumentCodec";
import { techniqueSheetService } from "@/services/techniqueSheetService";
import type { TechniqueSheetRecord } from "@/services/techniqueSheetService";
import type { RtPtDocumentV3 } from "@/types/rtPtDocument";
import { useAutoSave } from "@/hooks/useAutoSave";

interface UseSheetPersistenceParams {
  user: { id: string } | null;
  standard: string;
  documentTitle: string;
  documentDescription?: string;
  completionPercent: number;
  buildTechniqueSheetPayload: () => RtPtDocumentV3;
  buildCardData: () => RtPtDocumentV3;
  applyLoadedSheet: (record: TechniqueSheetRecord) => void;
  applyLocalCard: (data: RtPtDocumentV3) => void;
}

interface SaveResult {
  saved: boolean;
  storage?: "local" | "database";
  mode?: "created" | "updated";
  name?: string;
  requiresName?: boolean;
}

interface PersistenceIdentity {
  currentSheetId: string | null;
  currentSheetName: string;
  currentLocalCardId: string | null;
  localCardExists: boolean;
}

export type PersistenceSaveTarget =
  | { storage: "local"; cardId: string }
  | { storage: "database"; sheetId: string; sheetName: string }
  | null;

export function resolvePersistenceSaveTarget({
  currentSheetId,
  currentSheetName,
  currentLocalCardId,
  localCardExists,
}: PersistenceIdentity): PersistenceSaveTarget {
  // Two simultaneous source IDs are an invalid legacy/race state. Failing closed
  // prevents Save from silently overwriting whichever stale source happens to win.
  if (currentLocalCardId && currentSheetId) return null;

  if (currentLocalCardId && localCardExists) {
    return { storage: "local", cardId: currentLocalCardId };
  }

  if (currentSheetId && currentSheetName.trim()) {
    return {
      storage: "database",
      sheetId: currentSheetId,
      sheetName: currentSheetName,
    };
  }

  return null;
}

export function useSheetPersistence({
  user,
  standard,
  documentTitle,
  documentDescription,
  completionPercent,
  buildTechniqueSheetPayload,
  buildCardData,
  applyLoadedSheet,
  applyLocalCard,
}: UseSheetPersistenceParams) {
  const { saveCard, updateCard, getCard } = useSavedCards();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [savedSheets, setSavedSheets] = useState<TechniqueSheetRecord[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSavedCardsDialogOpen, setIsSavedCardsDialogOpen] = useState(false);
  const [sheetNameInput, setSheetNameInput] = useState("");
  const [currentSheetId, setCurrentSheetId] = useState<string | null>(null);
  const [currentSheetName, setCurrentSheetName] = useState("");
  const [currentLocalCardId, setCurrentLocalCardId] = useState<string | null>(null);

  const [isSavingSheet, setIsSavingSheet] = useState(false);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [loadingSheetId, setLoadingSheetId] = useState<string | null>(null);
  const [deletingSheetId, setDeletingSheetId] = useState<string | null>(null);

  const buildSuggestedCardName = useCallback(() => (
    currentSheetName ||
    documentTitle.trim() ||
    `RT-PT Technique ${new Date().toLocaleDateString("he-IL")}`
  ), [currentSheetName, documentTitle]);

  const buildLocalCardPayload = useCallback((name: string, existingCard?: Partial<SavedCard>) => {
    const decoded = decodeRtPtDocument(buildCardData());
    if (decoded.status !== "success") {
      throw new Error(`Cannot save this RT/PT card: ${decoded.message}`);
    }

    return {
      name,
      description: documentDescription || `${documentTitle || name} - ${standard}`,
      standard,
      completionPercent,
      tags: existingCard?.tags || [],
      isFavorite: existingCard?.isFavorite || false,
      isArchived: existingCard?.isArchived || false,
      data: decoded.document,
    } satisfies Omit<SavedCard, "id" | "profileId" | "createdAt" | "updatedAt">;
  }, [
    buildCardData,
    documentTitle,
    documentDescription,
    standard,
    completionPercent,
  ]);

  // ── Organization loading ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadOrganizations = async () => {
      try {
        const organizations = await techniqueSheetService.fetchOrganizations(user.id);
        if (cancelled) return;
        if (organizations.length > 0) {
          setOrganizationId(organizations[0].id);
        } else {
          setOrganizationId(null);
          console.log("No organizations available - auto-save to database is disabled.");
        }
      } catch (error) {
        if (!cancelled) {
          logError("Failed to load organizations", error);
          toast.error("Unable to load workspace information. Saving is temporarily unavailable.");
        }
      }
    };
    loadOrganizations();
    return () => { cancelled = true; };
  }, [user]);

  // ── Refresh saved sheets ──────────────────────────────────────────────
  const refreshSavedSheets = useCallback(async () => {
    if (!user || !organizationId) return;
    setIsLoadingSheets(true);
    try {
      const sheets = await techniqueSheetService.loadTechniqueSheets(user.id, organizationId);
      const sorted = [...sheets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setSavedSheets(sorted);
    } catch (error) {
      logError("Failed to load saved technique cards", error);
      toast.error(error instanceof Error ? error.message : "Unable to load saved cards.");
    } finally {
      setIsLoadingSheets(false);
    }
  }, [user, organizationId]);

  // ── Load when dialog opens ─────────────────────────────────────────────
  useEffect(() => {
    if (!isSavedCardsDialogOpen || !user || !organizationId) return;
    refreshSavedSheets();
  }, [isSavedCardsDialogOpen, user, organizationId, refreshSavedSheets]);

  // ── Handle opening saved cards dialog ──────────────────────────────────
  const handleOpenSavedCards = useCallback(() => {
    if (!user) {
      toast.error("The local workspace identity is not ready yet.");
      return;
    }
    if (!organizationId) {
      toast.error("Workspace is not ready yet. Please try again in a moment.");
      return;
    }
    setIsSavedCardsDialogOpen(true);
  }, [user, organizationId]);

  // ── Load a sheet from DB ──────────────────────────────────────────────
  const handleLoadSheet = useCallback(async (sheetId: string) => {
    if (!user || !organizationId) return;
    setLoadingSheetId(sheetId);
    try {
      const sheet = await techniqueSheetService.loadTechniqueSheet({
        sheetId,
        userId: user.id,
        orgId: organizationId,
      });
      applyLoadedSheet(sheet);
      setCurrentSheetId(sheet.id);
      setCurrentLocalCardId(null);
      setCurrentSheetName(sheet.sheetName);
      setSheetNameInput(sheet.sheetName);
      setIsSavedCardsDialogOpen(false);
      toast.success(`Loaded card "${sheet.sheetName}"`);
      return sheet;
    } catch (error) {
      logError("Failed to load technique card", error);
      toast.error(error instanceof Error ? error.message : "Unable to load the selected card.");
      return null;
    } finally {
      setLoadingSheetId(null);
    }
  }, [user, organizationId, applyLoadedSheet]);

  // ── Delete a sheet from DB ─────────────────────────────────────────────
  const handleDeleteSheet = useCallback(async (sheetId: string) => {
    if (!user || !organizationId) return;
    if (!confirm("Delete this saved card? This action cannot be undone.")) return;
    setDeletingSheetId(sheetId);
    try {
      await techniqueSheetService.deleteTechniqueSheet(sheetId, user.id, organizationId);
      if (currentSheetId === sheetId) {
        setCurrentSheetId(null);
        setCurrentSheetName("");
      }
      await refreshSavedSheets();
      toast.success("Card deleted.");
    } catch (error) {
      logError("Failed to delete technique card", error);
      toast.error("Unable to delete the selected card.");
    } finally {
      setDeletingSheetId(null);
    }
  }, [user, organizationId, currentSheetId, refreshSavedSheets]);

  // ── Perform DB save ────────────────────────────────────────────────────
  const performSave = useCallback(async (name: string, sheetId?: string) => {
    if (!user || !organizationId) {
      toast.error("The local workspace is not ready to save yet.");
      return null;
    }
    setIsSavingSheet(true);
    try {
      const payload = buildTechniqueSheetPayload();
      const saved = await techniqueSheetService.saveTechniqueSheet({
        sheetId,
        sheetName: name.trim(),
        standard,
        data: payload,
        userId: user.id,
        orgId: organizationId,
      });
      setCurrentSheetId(saved.id);
      setCurrentLocalCardId(null);
      setCurrentSheetName(saved.sheetName);
      setSheetNameInput(saved.sheetName);
      setIsSaveDialogOpen(false);
      await refreshSavedSheets();
      toast.success(sheetId ? "Technique card updated." : "Technique card saved.");
      return saved;
    } catch (error) {
      logError("Failed to save technique card", error);
      toast.error(error instanceof Error ? error.message : "Unable to save the technique card.");
      return null;
    } finally {
      setIsSavingSheet(false);
    }
  }, [user, organizationId, standard, buildTechniqueSheetPayload, refreshSavedSheets]);

  // ── Local save (localStorage via SavedCards context) ───────────────────
  const performLocalSave = useCallback((name: string) => {
    const savedCard = saveCard(buildLocalCardPayload(name));
    setCurrentLocalCardId(savedCard.id);
    setCurrentSheetId(null);
    setCurrentSheetName(name);
    toast.success(`Card "${name}" saved successfully!`);
    setIsSaveDialogOpen(false);
    return savedCard;
  }, [buildLocalCardPayload, saveCard]);

  const updateExistingLocalCard = useCallback((existingCard: SavedCard): SaveResult => {
    updateCard(existingCard.id, buildLocalCardPayload(existingCard.name, existingCard));
    setCurrentLocalCardId(existingCard.id);
    setCurrentSheetId(null);
    setCurrentSheetName(existingCard.name);
    toast.success(`Card "${existingCard.name}" updated successfully!`);

    return {
      saved: true,
      storage: "local",
      mode: "updated",
      name: existingCard.name,
    };
  }, [buildLocalCardPayload, updateCard]);

  // ── Save dialog confirm ────────────────────────────────────────────────
  const handleSaveDialogConfirm = useCallback(async (): Promise<SaveResult> => {
    const trimmedName = sheetNameInput.trim();
    if (!trimmedName) {
      toast.error("Please enter a name for the card.");
      return { saved: false };
    }
    const savedCard = performLocalSave(trimmedName);
    return {
      saved: true,
      storage: "local",
      mode: "created",
      name: savedCard.name,
    };
  }, [sheetNameInput, performLocalSave]);

  // ── handleSave (Ctrl+S / toolbar) ─────────────────────────────────────
  const handleSave = useCallback(async (): Promise<SaveResult> => {
    if (isSavingSheet) return { saved: false };

    const existingLocalCard = currentLocalCardId ? getCard(currentLocalCardId) : undefined;
    const target = resolvePersistenceSaveTarget({
      currentSheetId,
      currentSheetName,
      currentLocalCardId,
      localCardExists: Boolean(existingLocalCard),
    });

    if (target?.storage === "local" && existingLocalCard) {
      return updateExistingLocalCard(existingLocalCard);
    }

    if (target?.storage === "database") {
      const savedSheet = await performSave(target.sheetName, target.sheetId);
      if (savedSheet) {
        return {
          saved: true,
          storage: "database",
          mode: "updated",
          name: savedSheet.sheetName,
        };
      }

      return { saved: false };
    }

    const suggestedName = buildSuggestedCardName();
    setSheetNameInput(suggestedName);
    setIsSaveDialogOpen(true);
    return { saved: false, requiresName: true, name: suggestedName };
  }, [
    isSavingSheet,
    currentLocalCardId,
    getCard,
    currentSheetId,
    currentSheetName,
    performSave,
    buildSuggestedCardName,
    updateExistingLocalCard,
  ]);

  const saveCurrentCardSilently = useCallback(async (): Promise<SaveResult> => {
    if (isSavingSheet) return { saved: false };

    const existingLocalCard = currentLocalCardId ? getCard(currentLocalCardId) : undefined;
    const target = resolvePersistenceSaveTarget({
      currentSheetId,
      currentSheetName,
      currentLocalCardId,
      localCardExists: Boolean(existingLocalCard),
    });

    if (target?.storage === "local" && existingLocalCard) {
      return updateExistingLocalCard(existingLocalCard);
    }

    if (target?.storage === "database") {
      const savedSheet = await performSave(target.sheetName, target.sheetId);
      if (savedSheet) {
        return {
          saved: true,
          storage: "database",
          mode: "updated",
          name: savedSheet.sheetName,
        };
      }

      return { saved: false };
    }

    const savedCard = performLocalSave(buildSuggestedCardName());
    return {
      saved: true,
      storage: "local",
      mode: "created",
      name: savedCard.name,
    };
  }, [
    isSavingSheet,
    currentLocalCardId,
    getCard,
    currentSheetId,
    currentSheetName,
    performSave,
    performLocalSave,
    buildSuggestedCardName,
    updateExistingLocalCard,
  ]);

  const handleSaveAs = useCallback(() => {
    const baseName =
      currentSheetName ||
      documentTitle.trim() ||
      `RT-PT Technique ${new Date().toLocaleDateString("he-IL")}`;

    const suggestedCopyName = `${baseName} (copy)`;
    setSheetNameInput(suggestedCopyName);
    // Preserve the current save target while the dialog is open. The identity
    // switches to the newly-created copy only after confirmation; cancelling
    // Save As must leave the original card as the target of the next Save.
    setIsSaveDialogOpen(true);
  }, [currentSheetName, documentTitle]);

  // ── Handle loading local card ──────────────────────────────────────────
  const handleLoadLocalCard = useCallback((card: SavedCard) => {
    try {
      const decoded = decodeRtPtDocument(card.data);
      if (decoded.status !== "success") {
        throw new Error(`Cannot load this RT/PT card: ${decoded.message}`);
      }
      applyLocalCard(decoded.document);
      setCurrentLocalCardId(card.id);
      setCurrentSheetId(null);
      setCurrentSheetName(card.name);
      toast.success(`Loaded card: ${card.name}`);
      return card;
    } catch (error) {
      logError("Failed to load local RT/PT card", error);
      toast.error(error instanceof Error ? error.message : "Unable to load the selected card.");
      return null;
    }
  }, [applyLocalCard]);

  // ── Auto-save hook ─────────────────────────────────────────────────────
  const autoSaveData = useMemo(() => buildTechniqueSheetPayload(), [buildTechniqueSheetPayload]);

  const { status: autoSaveStatus, lastSaved, forceSave } = useAutoSave({
    data: autoSaveData,
    onSave: async (data) => {
      if (!user || !organizationId) {
        throw new Error("Local workspace identity or organization is unavailable");
      }
      const now = new Date();
      const autoName = currentSheetName || `Draft - ${standard} - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      const saved = await techniqueSheetService.saveTechniqueSheet({
        sheetId: currentSheetId || undefined,
        sheetName: autoName,
        standard,
        data,
        userId: user.id,
        orgId: organizationId,
      });
      setCurrentLocalCardId(null);
      if (!currentSheetId) {
        setCurrentSheetId(saved.id);
        setCurrentSheetName(saved.sheetName);
        setSheetNameInput(saved.sheetName);
      }
    },
    delay: 3000,
    enabled: false,
  });

  return {
    // Dialog state
    isSaveDialogOpen, setIsSaveDialogOpen,
    isSavedCardsDialogOpen, setIsSavedCardsDialogOpen,
    sheetNameInput, setSheetNameInput,
    currentSheetId, setCurrentSheetId,
    currentSheetName, setCurrentSheetName,
    currentLocalCardId, setCurrentLocalCardId,
    // Loading state
    isSavingSheet,
    isLoadingSheets,
    loadingSheetId,
    deletingSheetId,
    savedSheets,
    // Actions
    handleSave,
    handleSaveAs,
    handleOpenSavedCards,
    handleLoadSheet,
    handleDeleteSheet,
    handleSaveDialogConfirm,
    handleLoadLocalCard,
    performSave,
    performLocalSave,
    saveCurrentCardSilently,
    refreshSavedSheets,
    // Auto-save
    autoSaveStatus,
    lastSaved,
    forceSave,
  };
}
