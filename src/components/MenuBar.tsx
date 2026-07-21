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
import { FileText, Save, Download, FolderOpen, Info, Book, Stethoscope, HardDrive, Usb } from "lucide-react";

interface MenuBarProps {
  onSave: () => void;
  onSaveAs?: () => void;
  onOpenSavedCards: () => void;
  onExport: () => void;
  onNew: () => void;
  onExportDiagnostics?: () => void;
  onRunDiagnostics?: () => void;
  onOfflineUpdate?: () => void;
}

export const MenuBar = ({ onSave, onSaveAs, onOpenSavedCards, onExport, onNew, onExportDiagnostics, onRunDiagnostics, onOfflineUpdate }: MenuBarProps) => {
  return (
    <Menubar className="h-10 flex-shrink-0 rounded-none border-x-0 border-t-0 border-b border-border/80 bg-card/95 px-2 shadow-none">
      <MenubarMenu>
        <MenubarTrigger className="px-3 py-1.5 text-sm font-semibold">File</MenubarTrigger>
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
          <MenubarItem onClick={onExport} className="text-base py-2">
            <Download className="mr-3 h-5 w-5" />
            Export PDF
            <MenubarShortcut className="text-sm">Ctrl+E</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="px-3 py-1.5 text-sm font-semibold">Help</MenubarTrigger>
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
          <MenubarItem onClick={() => alert(`RT-PT Inspector v${__APP_VERSION__}\nRadiographic and Penetrant Testing Inspection System`)} className="text-base py-2">
            <Info className="mr-3 h-5 w-5" />
            About
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
