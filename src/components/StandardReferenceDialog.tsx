import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { StandardReference } from "@/data/standardReferences";
import { StandardType } from "@/types/techniqueSheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

interface StandardReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: StandardReference | undefined;
  fieldLabel: string;
  standardType?: StandardType;
}

export const StandardReferenceDialog = ({
  open,
  onOpenChange,
  reference,
  fieldLabel,
  standardType = "AMS-STD-2154E"
}: StandardReferenceDialogProps) => {
  const isMobile = useIsMobile();
  
  if (!reference) return null;

  const pdfByStandard: Partial<Record<StandardType, string>> = {
    "ASTM-A388": "/standards/ASTM_A388.pdf",
    "ASTM-E2375": "/standards/E2375.pdf",
    "ASTM-E1001": "/standards/ASTM_E1001_21.pdf",
    "ASTM-E2580": "/standards/ASTM_E2580_24.pdf",
    "ASTM-E588": "/standards/ASTM_E588_03R20.pdf",
    "AMS-2630": "/standards/AMS_2630E.pdf",
    "NDIP-1226": "/standards/NDIP_1226_RevF.pdf",
    "NDIP-1227": "/standards/NDIP_1227_RevD.pdf",
    "MIL-STD-2154": "/standards/MIL-STD-2154.pdf",
    // AMS-STD-2154E is handled by MIL-STD-2154 legacy document in this build.
    "AMS-STD-2154E": "/standards/MIL-STD-2154.pdf",
  };

  const getPdfPathForStandard = (std: StandardType): string | null => {
    return pdfByStandard[std] ?? null;
  };

  const pdfPath = getPdfPathForStandard(standardType);

  const handleOpenPDF = () => {
    if (!pdfPath) {
      toast.warning(`No bundled PDF is available for ${standardType} in this build.`);
      return;
    }
    window.open(pdfPath, '_blank');
  };

  const content = (
    <>
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-sm mb-2 text-foreground">
            {reference.title}
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {reference.text}
          </p>
        </div>

        {reference.table && (
          <div className="p-3 bg-muted/30 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">
              📋 For complete details, refer to <strong>{reference.table}</strong> in the full standard document.
            </p>
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <DrawerTitle className="text-xl">
                {fieldLabel}
              </DrawerTitle>
            </div>
            <DrawerDescription className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {standardType} {reference.section}
              </Badge>
              {reference.table && (
                <Badge variant="outline" className="text-xs bg-accent/10">
                  {reference.table}
                </Badge>
              )}
            </DrawerDescription>
          </DrawerHeader>

          <ScrollArea className="max-h-[50vh] px-4">
            {content}
          </ScrollArea>

          <DrawerFooter className="pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPDF}
              disabled={!pdfPath}
              className="gap-2 w-full"
            >
              <ExternalLink className="h-4 w-4" />
              Open Full Standard (PDF)
            </Button>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl">
              {fieldLabel}
            </DialogTitle>
          </div>
          <DialogDescription className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {standardType} {reference.section}
            </Badge>
            {reference.table && (
              <Badge variant="outline" className="text-xs bg-accent/10">
                {reference.table}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {content}
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPDF}
            disabled={!pdfPath}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open Full Standard (PDF)
          </Button>
          
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
