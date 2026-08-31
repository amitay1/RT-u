import React from "react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { FileText, Save, Download, FolderOpen, Info, Book, Stethoscope, HardDrive, Usb, ClipboardCheck } from "lucide-react";
import type { RtPtWorkspaceMode } from "@/types/rtPtDocument";

interface MenuBarProps {
  onSave: () => void;
  onSaveAs?: () => void;
  onOpenSavedCards: () => void;
  onExportTechnique: () => void;
  onExportInspectionReport: () => void;
  onExportExposureSheet?: () => void;
  workspaceMode: RtPtWorkspaceMode;
  onNew: () => void;
  onExportDiagnostics?: () => void;
  onRunDiagnostics?: () => void;
  onOfflineUpdate?: () => void;
}

export const MenuBar = ({ onSave, onSaveAs, onOpenSavedCards, onExportTechnique, onExportInspectionReport, onExportExposureSheet, workspaceMode, onNew, onExportDiagnostics, onRunDiagnostics, onOfflineUpdate }: MenuBarProps) => {
  return (
    <Menubar className="app-menubar h-9 flex-shrink-0 rounded-none border-0 bg-transparent px-2 shadow-none">
      <MenubarMenu>
        <MenubarTrigger className="px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onNew} className="text-base py-2">
            <FileText className="mr-3 h-5 w-5" />
            New Project
            <MenubarShortcut className="text-sm">Ctrl+N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onOpenSavedCards} className="text-base py-2">
            <FolderOpen className="mr-3 h-5 w-5" />
            Open
            <MenubarShortcut className="text-sm">Ctrl+O</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onSave} className="text-base py-2">
            <Save className="mr-3 h-5 w-5" />
            Save
            <MenubarShortcut className="text-sm">Ctrl+S</MenubarShortcut>
          </MenubarItem>
          {onSaveAs && (
            <MenubarItem onClick={onSaveAs} className="text-base py-2">
              <Save className="mr-3 h-5 w-5" />
              Save As...
              <MenubarShortcut className="text-sm">Ctrl+Shift+S</MenubarShortcut>
            </MenubarItem>
          )}
          <MenubarItem onClick={onExportTechnique} className="text-base py-2">
            <Download className="mr-3 h-5 w-5" />
            Export Technique PDF
            {workspaceMode === "technique" && <MenubarShortcut className="text-sm">Ctrl+E</MenubarShortcut>}
          </MenubarItem>
          {onExportExposureSheet && (
            <MenubarItem onClick={onExportExposureSheet} className="text-base py-2">
              <Download className="mr-3 h-5 w-5" />
              Export Film Exposure Sheet PDF
            </MenubarItem>
          )}
          <MenubarItem onClick={onExportInspectionReport} className="text-base py-2">
            <ClipboardCheck className="mr-3 h-5 w-5" />
            Export Inspection Report PDF
            {workspaceMode === "inspection" && <MenubarShortcut className="text-sm">Ctrl+E</MenubarShortcut>}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground">Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => window.open('https://github.com/amitay1/RT-u#readme', '_blank')} className="text-base py-2">
            <Book className="mr-3 h-5 w-5" />
            Documentation
          </MenubarItem>
          <MenubarSeparator />
          {onRunDiagnostics && (
            <MenubarItem onClick={onRunDiagnostics} className="text-base py-2">
              <Stethoscope className="mr-3 h-5 w-5" />
              Run Diagnostics
            </MenubarItem>
          )}
          {onExportDiagnostics && (
            <MenubarItem onClick={onExportDiagnostics} className="text-base py-2">
              <HardDrive className="mr-3 h-5 w-5" />
              Export Diagnostics (USB)
            </MenubarItem>
          )}
          {onOfflineUpdate && (
            <MenubarItem onClick={onOfflineUpdate} className="text-base py-2">
              <Usb className="mr-3 h-5 w-5" />
              Install Update from USB
            </MenubarItem>
          )}
          <MenubarSeparator />
          <MenubarItem onClick={() => alert(`RT Inspector v${__APP_VERSION__}\nRadiographic Technique Engineering Platform`)} className="text-base py-2">
            <Info className="mr-3 h-5 w-5" />
            About
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
