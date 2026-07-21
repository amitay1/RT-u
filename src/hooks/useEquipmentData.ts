import { useState, useEffect } from 'react';
import type { EquipmentTabFields } from '@/types/scanMasterCAD';

// Mock data - in reality this would come from context or state management
const defaultEquipmentData: EquipmentTabFields = {
  probeType: "contact",
  frequency: 5.0,
  inspectionType: "straight_beam"
};

export function useEquipmentData(): EquipmentTabFields {
  const [equipmentData, setEquipmentData] = useState<EquipmentTabFields>(defaultEquipmentData);

  // Here you can add logic to load real data
  // For example from localStorage, context, or API call
  useEffect(() => {
    // Load saved data from localStorage if exists
    const savedData = localStorage.getItem('rtpt-inspector-equipment-data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setEquipmentData({ ...defaultEquipmentData, ...parsed });
      } catch (error) {
        console.warn('Failed to parse saved equipment data:', error);
      }
    }
  }, []);

  // Save data when it changes
  useEffect(() => {
    localStorage.setItem('rtpt-inspector-equipment-data', JSON.stringify(equipmentData));
  }, [equipmentData]);

  return equipmentData;
}

// Additional hook for updating Equipment data
export function useEquipmentDataUpdater() {
  const [equipmentData, setEquipmentData] = useState<EquipmentTabFields>(defaultEquipmentData);

  const updateEquipmentData = (updates: Partial<EquipmentTabFields>) => {
    setEquipmentData(prev => ({
      ...prev,
      ...updates
    }));
  };

  return {
    equipmentData,
    updateEquipmentData
  };
}
