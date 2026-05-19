import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanPlanData } from "@/types/techniqueSheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  ExternalLink,
  Download,
  RefreshCw,
  Maximize2,
  Minimize2,
  ChevronDown,
  PlayCircle,
} from "lucide-react";
import mammoth from 'mammoth';
import { VideoPlayer } from "@/components/training/VideoPlayer";
import { getVideoBySlug } from "@/data/videoCatalog";
import { V2500ScanSimulator } from "@/components/scanning/V2500ScanSimulator";
import { Plane } from "lucide-react";

/**
 * Map a Scan-Plan document → its companion training video slug.
 * Matched by basename of `filePath` (without extension) so the same physical
 * document is recognised across QuickFill presets — e.g. "scan-plan-1",
 * "tube-plan-guide", "plate-plan-guide" all point at scan-plan-guide.docx
 * and therefore share the same companion video.
 */
const DOCUMENT_VIDEO_MAP: Record<string, string> = {
  "scan-plan-guide": "tube-scan-plan-tcg-calibration",
  "tcg-shear-wave-calibration": "angle-beam-tcg-calibration-shear-wave",
  // V2500 Stage 1 HPT disk — companion to the immersion scan tutorial (id 103)
  "v2500-hpt-disk-stage-1": "v2500-hpt-disk-scan-tutorial",
  "ndip-1226": "v2500-hpt-disk-scan-tutorial",
  "ndip-1226-rev-f": "v2500-hpt-disk-scan-tutorial",
};

/**
 * Heuristic: does an active scan-plan document refer to the V2500 Stage 1 HPT
 * disk immersion procedure? Triggers the embedded interactive simulator.
 */
function isV2500ScanPlan(docs: { filePath: string; title: string; description: string }[]): boolean {
  return docs.some((d) => {
    const blob = `${d.filePath} ${d.title} ${d.description}`.toLowerCase();
    return /\bv2500\b|\bndip-?1226\b|\bhpt\s*(disk|stage\s*1)\b/.test(blob);
  });
}

function videoSlugForDocument(filePath: string): string | undefined {
  // Strip directories and extension: "/documents/scan-plan-guide.docx" -> "scan-plan-guide"
  const basename = filePath.split(/[/\\]/).pop() ?? "";
  const stem = basename.replace(/\.[^.]+$/, "").toLowerCase();
  return DOCUMENT_VIDEO_MAP[stem];
}

interface ScanPlanTabProps {
  data: ScanPlanData;
  onChange: (data: ScanPlanData) => void;
}

export const ScanPlanTab = ({ data, onChange }: ScanPlanTabProps) => {
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [documentHtml, setDocumentHtml] = useState<Record<string, string>>({});
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState<Record<string, boolean>>({});
  const [openDocs, setOpenDocs] = useState<Record<string, boolean>>({});
  const [key, setKey] = useState(0);

  // Filter only active documents and sort by order
  const activeDocuments = data.documents
    .filter(doc => doc.isActive)
    .sort((a, b) => a.order - b.order);

  // Initialize open state for all documents (first one open by default)
  useEffect(() => {
    if (activeDocuments.length > 0 && Object.keys(openDocs).length === 0) {
      const initialOpenState: Record<string, boolean> = {};
      activeDocuments.forEach((doc, index) => {
        initialOpenState[doc.id] = index === 0; // First doc open by default
      });
      setOpenDocs(initialOpenState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocuments]);

  // Load individual document
  const loadDocument = async (docId: string, filePath: string, title: string) => {
    setIsLoading(prev => ({ ...prev, [docId]: true }));
    setLoadErrors(prev => ({ ...prev, [docId]: false }));
    
    try {
      const fileUrl = filePath.startsWith('/') 
        ? `http://localhost:5000${filePath}` 
        : filePath;
      
      if (filePath.toLowerCase().endsWith('.docx') || filePath.toLowerCase().endsWith('.doc')) {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Failed to fetch ${title}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        setDocumentHtml(prev => ({ ...prev, [docId]: result.value }));
      }
      setIsLoading(prev => ({ ...prev, [docId]: false }));
    } catch (error) {
      console.error(`Error loading document ${title}:`, error);
      setLoadErrors(prev => ({ ...prev, [docId]: true }));
      setIsLoading(prev => ({ ...prev, [docId]: false }));
    }
  };

  // Load documents on mount and when key changes
  useEffect(() => {
    activeDocuments.forEach(doc => {
      loadDocument(doc.id, doc.filePath, doc.title);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, activeDocuments.length]);

  const handleRefresh = (docId: string) => {
    const doc = activeDocuments.find(d => d.id === docId);
    if (doc) {
      loadDocument(doc.id, doc.filePath, doc.title);
    }
  };

  const handleDownload = (doc: typeof activeDocuments[0]) => {
    const link = document.createElement('a');
    const fileUrl = doc.filePath.startsWith('/') ? `http://localhost:5000${doc.filePath}` : doc.filePath;
    link.href = fileUrl;
    const ext = doc.filePath.split('.').pop() || 'docx';
    link.download = doc.title + '.' + ext;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenExternal = (filePath: string) => {
    const fileUrl = filePath.startsWith('/') ? `http://localhost:5000${filePath}` : filePath;
    window.open(fileUrl, '_blank');
  };

  const toggleFullscreen = (docId: string) => {
    setIsFullscreen(prev => ({ ...prev, [docId]: !prev[docId] }));
  };

  const toggleDoc = (docId: string) => {
    setOpenDocs(prev => ({ ...prev, [docId]: !prev[docId] }));
  };

  // Hooks must be called in the same order every render — keep them above any
  // conditional return. Detect whether the simulator should show.
  const showV2500Simulator = isV2500ScanPlan(activeDocuments);
  const [simOpen, setSimOpen] = useState<boolean>(false);
  useEffect(() => {
    if (showV2500Simulator) setSimOpen(true);
  }, [showV2500Simulator]);

  if (activeDocuments.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-2">
        <Card className="p-8 text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Documents Available</h3>
          <p className="text-sm text-muted-foreground">
            No scan plan documents have been configured
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-2">
      {showV2500Simulator && (
        <Collapsible open={simOpen} onOpenChange={setSimOpen}>
          <Card className="overflow-hidden border-cyan-400/40 bg-gradient-to-br from-slate-950 to-slate-900">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 hover:bg-cyan-950/30 transition-colors cursor-pointer border-b border-cyan-900/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-600 rounded-lg">
                    <Plane className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg text-cyan-300">
                      ✈ V2500 HPT Disk — Interactive Scan Simulator
                    </h3>
                    <p className="text-sm text-slate-400">
                      Interactive 3D rehearsal of the immersion scan · 5 zones · ±45° shear wave · 10 passes
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`h-6 w-6 text-cyan-300 transition-transform duration-300 ${
                    simOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3">
                <V2500ScanSimulator />
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
      {activeDocuments.map((doc) => {
        const companionVideo = (() => {
          const slug = videoSlugForDocument(doc.filePath);
          if (!slug) return null;
          const v = getVideoBySlug(slug);
          return v?.published ? v : null;
        })();

        return (
        <div key={doc.id} className="flex flex-col gap-3">
        {companionVideo && (
          <Collapsible defaultOpen>
            <Card className="overflow-hidden border-cyan-400/40 bg-gradient-to-br from-slate-50 to-cyan-50">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 bg-cyan-50/80 hover:bg-cyan-100/80 transition-colors cursor-pointer border-b border-cyan-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-600 rounded-lg">
                      <PlayCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg text-slate-800">
                        🎬 Video Tutorial — {companionVideo.title}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {Math.floor(companionVideo.durationSeconds / 60)}:
                        {String(companionVideo.durationSeconds % 60).padStart(2, "0")} ·
                        Companion video for {doc.title}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="h-6 w-6 text-slate-500 transition-transform duration-300 group-data-[state=closed]:rotate-0 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4">
                  <VideoPlayer video={companionVideo} />
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
        <Collapsible
          open={openDocs[doc.id]}
          onOpenChange={() => toggleDoc(doc.id)}
        >
          <Card className={`overflow-hidden ${isFullscreen[doc.id] ? 'fixed inset-2 z-50' : ''}`}>
            {/* Collapsible Header */}
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-600 rounded-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg text-slate-800">{doc.title}</h3>
                    <p className="text-sm text-slate-500">
                      {doc.description} • Click to {openDocs[doc.id] ? 'collapse' : 'expand'}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`h-6 w-6 text-slate-500 transition-transform duration-300 ${
                    openDocs[doc.id] ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              {/* Toolbar */}
              <div className="flex items-center justify-end gap-2 p-2 bg-muted/30 border-b">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleRefresh(doc.id); }}
                  className="h-8"
                  title="Refresh document"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); toggleFullscreen(doc.id); }}
                  className="h-8"
                  title={isFullscreen[doc.id] ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen[doc.id] ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                  className="h-8"
                  title="Download document"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleOpenExternal(doc.filePath); }}
                  className="h-8"
                  title="Open in new window"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open External
                </Button>
              </div>

              {/* Document Content */}
              <div className={`overflow-auto bg-slate-200 ${isFullscreen[doc.id] ? 'h-[calc(100vh-150px)]' : 'h-[700px]'}`}>
                {isLoading[doc.id] ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
                    <p className="text-sm text-muted-foreground">Loading {doc.title}...</p>
                  </div>
                ) : loadErrors[doc.id] ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                    <FileText className="h-16 w-16 text-muted-foreground/50" />
                    <p className="text-lg font-medium text-destructive">Failed to Load Document</p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Could not load "{doc.title}". Try refreshing or download it directly.
                    </p>
                    <div className="flex gap-3">
                      <Button onClick={() => handleRefresh(doc.id)} variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                      <Button onClick={() => handleDownload(doc)} variant="default">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 flex justify-center">
                    <div 
                      className="a4-page prose prose-sm max-w-none"
                      style={{ 
                        backgroundColor: 'white',
                        color: 'black',
                        fontFamily: 'Arial, sans-serif',
                        width: '210mm',
                        minHeight: '297mm',
                        padding: '20mm',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        boxSizing: 'border-box'
                      }}
                    >
                      <style>{`
                        .a4-page {
                          line-height: 1.6;
                        }
                        .a4-page table {
                          width: 100%;
                          border-collapse: collapse;
                          margin: 1rem 0;
                        }
                        .a4-page table td,
                        .a4-page table th {
                          border: 1px solid #ccc;
                          padding: 8px;
                        }
                        .a4-page img {
                          max-width: 100%;
                          height: auto;
                        }
                        .a4-page h1, .a4-page h2, .a4-page h3 {
                          page-break-after: avoid;
                        }
                        .a4-page p {
                          orphans: 3;
                          widows: 3;
                        }
                        @media print {
                          .a4-page {
                            width: 210mm;
                            min-height: 297mm;
                            padding: 20mm;
                            margin: 0;
                            box-shadow: none;
                          }
                        }
                      `}</style>
                      <div 
                        dangerouslySetInnerHTML={{ __html: documentHtml[doc.id] || '' }} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        </div>
        );
      })}
    </div>
  );
};
