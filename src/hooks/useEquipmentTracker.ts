/**
 * Equipment Tracker Hooks
 * React Query hooks for managing UT equipment, calibration, and maintenance
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Equipment,
  EquipmentFormData,
  EquipmentStats,
  EquipmentFilters,
  CalibrationRecord,
  CalibrationFormData,
  MaintenanceRecord,
  MaintenanceFormData,
  EquipmentTypeDefinition,
} from "@/types/equipment";

const API_BASE = "/api";

// Get auth headers
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Get user ID from localStorage or context
  const userId = localStorage.getItem("rtpt_inspector_user_id") || "00000000-0000-0000-0000-000000000000";
  const orgId = localStorage.getItem("rtpt_inspector_org_id");

  headers["x-user-id"] = userId;
  if (orgId) {
    headers["x-org-id"] = orgId;
  }

  return headers;
}

// =====================================================
// EQUIPMENT QUERIES
// =====================================================

/**
 * Fetch all equipment for the current user/org
 */
export function useEquipment(filters?: EquipmentFilters) {
  return useQuery({
    queryKey: ["equipment", filters],
    queryFn: async (): Promise<Equipment[]> => {
      const params = new URLSearchParams();
      if (filters?.type) params.set("type", filters.type);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.dueSoon) params.set("dueSoon", "true");

      const url = `${API_BASE}/equipment${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch equipment");
      }

      return response.json();
    },
  });
}

/**
 * Fetch single equipment by ID
 */
export function useEquipmentById(id: string | null) {
  return useQuery({
    queryKey: ["equipment", id],
    queryFn: async (): Promise<Equipment> => {
      if (!id) throw new Error("Equipment ID required");

      const response = await fetch(`${API_BASE}/equipment/${id}`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch equipment");
      }

      return response.json();
    },
    enabled: !!id,
  });
}

/**
 * Fetch equipment statistics
 */
export function useEquipmentStats() {
  return useQuery({
    queryKey: ["equipment", "stats"],
    queryFn: async (): Promise<EquipmentStats> => {
      const response = await fetch(`${API_BASE}/equipment/stats`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch equipment stats");
      }

      return response.json();
    },
  });
}

/**
 * Fetch equipment due for calibration
 */
export function useEquipmentDueForCalibration(days: number = 30) {
  return useQuery({
    queryKey: ["equipment", "due-for-calibration", days],
    queryFn: async (): Promise<Equipment[]> => {
      const response = await fetch(
        `${API_BASE}/equipment/due-for-calibration?days=${days}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch equipment");
      }

      return response.json();
    },
  });
}

/**
 * Fetch equipment types reference
 */
export function useEquipmentTypes() {
  return useQuery({
    queryKey: ["equipment-types"],
    queryFn: async (): Promise<EquipmentTypeDefinition[]> => {
      const response = await fetch(`${API_BASE}/equipment-types`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch equipment types");
      }

      return response.json();
    },
    staleTime: Infinity, // Types don't change
  });
}

// =====================================================
// EQUIPMENT MUTATIONS
// =====================================================

/**
 * Create new equipment
 */
export function useCreateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EquipmentFormData): Promise<Equipment> => {
      const response = await fetch(`${API_BASE}/equipment`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create equipment");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
}

/**
 * Update equipment
 */
export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<EquipmentFormData>;
    }): Promise<Equipment> => {
      const response = await fetch(`${API_BASE}/equipment/${id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update equipment");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment", variables.id] });
    },
  });
}

/**
 * Delete equipment
 */
export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/equipment/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete equipment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
}

// =====================================================
// CALIBRATION QUERIES & MUTATIONS
// =====================================================

/**
 * Fetch calibration history for equipment
 */
export function useCalibrationHistory(equipmentId: string | null) {
  return useQuery({
    queryKey: ["equipment", equipmentId, "calibrations"],
    queryFn: async (): Promise<CalibrationRecord[]> => {
      if (!equipmentId) throw new Error("Equipment ID required");

      const response = await fetch(
        `${API_BASE}/equipment/${equipmentId}/calibrations`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch calibration history");
      }

      return response.json();
    },
    enabled: !!equipmentId,
  });
}

/**
 * Add calibration record
 */
export function useAddCalibration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      equipmentId,
      data,
    }: {
      equipmentId: string;
      data: CalibrationFormData;
    }): Promise<CalibrationRecord> => {
      const response = await fetch(
        `${API_BASE}/equipment/${equipmentId}/calibrations`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add calibration record");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({
        queryKey: ["equipment", variables.equipmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["equipment", variables.equipmentId, "calibrations"],
      });
    },
  });
}

// =====================================================
// MAINTENANCE QUERIES & MUTATIONS
// =====================================================

/**
 * Fetch maintenance history for equipment
 */
export function useMaintenanceHistory(equipmentId: string | null) {
  return useQuery({
    queryKey: ["equipment", equipmentId, "maintenance"],
    queryFn: async (): Promise<MaintenanceRecord[]> => {
      if (!equipmentId) throw new Error("Equipment ID required");

      const response = await fetch(
        `${API_BASE}/equipment/${equipmentId}/maintenance`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch maintenance history");
      }

      return response.json();
    },
    enabled: !!equipmentId,
  });
}

/**
 * Add maintenance record
 */
export function useAddMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      equipmentId,
      data,
    }: {
      equipmentId: string;
      data: MaintenanceFormData;
    }): Promise<MaintenanceRecord> => {
      const response = await fetch(
        `${API_BASE}/equipment/${equipmentId}/maintenance`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add maintenance record");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({
        queryKey: ["equipment", variables.equipmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["equipment", variables.equipmentId, "maintenance"],
      });
    },
  });
}
