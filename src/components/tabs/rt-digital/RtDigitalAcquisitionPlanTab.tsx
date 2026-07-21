import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RtDigitalAcquisitionFields } from '@/components/tabs/rt-digital/RtDigitalAcquisitionFields';
import { TextField } from '@/components/tabs/shared/FieldRow';
import { calculateDigitalGeometricUnsharpness } from '@/lib/rtGeometry';
import type { RtDigitalAcquisition, RtDigitalSource } from '@/types/rtDigital';

type AcquisitionPatch = Partial<Omit<RtDigitalAcquisition, 'id'>>;

interface Props {
  data: RtDigitalAcquisition[];
  source: RtDigitalSource;
  onAdd: () => void;
  onChange: (id: string, patch: AcquisitionPatch) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onDelete: (id: string) => void;
}

export function RtDigitalAcquisitionPlanTab({
  data,
  source,
  onAdd,
  onChange,
  onDuplicate,
  onMove,
  onDelete,
}: Props) {
  const collectionKey = data.map((acquisition) => acquisition.id).sort().join('|');

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>8. Acquisition Plan</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Build the complete planned digital acquisition matrix. At least one uniquely identified view is required for approval.
            </p>
          </div>
          <Button type="button" size="sm" onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Acquisition
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center">
            <div className="text-sm font-semibold">No acquisitions planned</div>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Add the first required view, then define its identity, orientation, attachment reference, geometry, IQI, exposure, frame, coverage, and marking instructions.
            </p>
            <Button type="button" className="mt-5" onClick={onAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add First Acquisition
            </Button>
          </div>
        ) : (
          <Accordion
            key={collectionKey}
            type="single"
            collapsible
            defaultValue={data[data.length - 1]?.id}
            className="space-y-3"
          >
            {data.map((acquisition, index) => {
              const calculatedUg = calculateDigitalGeometricUnsharpness(acquisition, source);

              return (
                <AccordionItem
                  key={acquisition.id}
                  value={acquisition.id}
                  className="rounded-2xl border border-border/80 bg-background/50 px-4 shadow-sm"
                >
                <AccordionTrigger className="gap-3 text-left hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Acquisition {index + 1}</span>
                    <span className="max-w-64 truncate text-sm text-muted-foreground">
                      {acquisition.viewId || 'View ID required'}
                    </span>
                    <Badge variant="secondary">Planned</Badge>
                    <Badge variant={acquisition.viewId.trim() ? 'outline' : 'destructive'}>
                      {acquisition.viewId.trim() ? 'Required ID set' : 'Required'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-normal"
                      title="Read-only geometry calculation; the limit remains the user-supplied Required Ug."
                    >
                      Calculated Ug (read-only): {calculatedUg === '' ? '—' : `${calculatedUg} ${acquisition.requiredUgUnit}`}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-5">
                  <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-border/70 pb-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(acquisition.id)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      aria-label={`Move acquisition ${index + 1} up`}
                      onClick={() => onMove(acquisition.id, 'up')}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === data.length - 1}
                      aria-label={`Move acquisition ${index + 1} down`}
                      onClick={() => onMove(acquisition.id, 'down')}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete acquisition ${index + 1}`}
                      onClick={() => onDelete(acquisition.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Required acquisition identity</h3>
                      <p className="text-xs text-muted-foreground">
                        Use controlled, project-specific identifiers; no values are inferred from example techniques.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <TextField
                        label="View ID"
                        value={acquisition.viewId}
                        onChange={(value) => onChange(acquisition.id, { viewId: value })}
                        hint="required and unique"
                      />
                      <TextField
                        label="Description"
                        value={acquisition.description}
                        onChange={(value) => onChange(acquisition.id, { description: value })}
                      />
                      <TextField
                        label="Orientation"
                        value={acquisition.orientation}
                        onChange={(value) => onChange(acquisition.id, { orientation: value })}
                      />
                      <TextField
                        label="Inspection Zone"
                        value={acquisition.inspectionZone}
                        onChange={(value) => onChange(acquisition.id, { inspectionZone: value })}
                      />
                      <TextField
                        label="Reference Attachment ID"
                        value={acquisition.referenceAttachmentId}
                        onChange={(value) => onChange(acquisition.id, { referenceAttachmentId: value })}
                        placeholder="Controlled drawing, sketch, or attachment"
                      />
                    </div>
                  </section>

                  <div className="border-t border-border/70 pt-5">
                    <RtDigitalAcquisitionFields
                      data={acquisition}
                      onChange={(patch) => onChange(acquisition.id, patch)}
                    />
                  </div>
                </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
