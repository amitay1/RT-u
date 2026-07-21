import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RtFilmExposureFields } from '@/components/tabs/rt-film/RtFilmExposureFields';
import { TextField } from '@/components/tabs/shared/FieldRow';
import { calculateFilmGeometricUnsharpness } from '@/lib/rtGeometry';
import type { RtFilmExposureView, RtFilmSource } from '@/types/rtFilm';

type ExposureViewPatch = Partial<Omit<RtFilmExposureView, 'id'>>;

interface Props {
  data: RtFilmExposureView[];
  source: RtFilmSource;
  ps811000Applicable: boolean;
  onAdd: () => void;
  onChange: (id: string, patch: ExposureViewPatch) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onDelete: (id: string) => void;
}

export function RtFilmExposureViewsTab({
  data,
  source,
  ps811000Applicable,
  onAdd,
  onChange,
  onDuplicate,
  onMove,
  onDelete,
}: Props) {
  const collectionKey = data.map((view) => view.id).sort().join('|');

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>7. Exposure Views</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Build the complete planned exposure matrix. At least one uniquely identified view is required for approval.
            </p>
          </div>
          <Button type="button" size="sm" onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Exposure View
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center">
            <div className="text-sm font-semibold">No exposure views planned</div>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Add the first required view, then define its orientation, attachment reference, geometry, IQI, exposure, film loading, overlap, and identification instructions.
            </p>
            <Button type="button" className="mt-5" onClick={onAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add First Exposure View
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
            {data.map((view, index) => {
              const calculatedUg = calculateFilmGeometricUnsharpness(view, source);
              return (
              <AccordionItem
                key={view.id}
                value={view.id}
                className="rounded-2xl border border-border/80 bg-background/50 px-4 shadow-sm"
              >
                <AccordionTrigger className="gap-3 text-left hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">View {index + 1}</span>
                    <span className="max-w-64 truncate text-sm text-muted-foreground">
                      {view.viewId || 'View ID required'}
                    </span>
                    <Badge variant="secondary">Planned</Badge>
                    <Badge variant={view.viewId.trim() ? 'outline' : 'destructive'}>
                      {view.viewId.trim() ? 'Required ID set' : 'Required'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-normal"
                      title="Read-only geometry calculation; the limit remains the user-supplied Required Ug."
                    >
                      Calculated Ug (read-only): {calculatedUg === '' ? '—' : `${calculatedUg} ${view.requiredUgUnit}`}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-5">
                  <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-border/70 pb-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(view.id)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      aria-label={`Move view ${index + 1} up`}
                      onClick={() => onMove(view.id, 'up')}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === data.length - 1}
                      aria-label={`Move view ${index + 1} down`}
                      onClick={() => onMove(view.id, 'down')}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete view ${index + 1}`}
                      onClick={() => onDelete(view.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Required view identity</h3>
                      <p className="text-xs text-muted-foreground">Use controlled, project-specific identifiers; no values are copied from example cards.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <TextField label="View ID" value={view.viewId} onChange={(value) => onChange(view.id, { viewId: value })} hint="required and unique" />
                      <TextField label="Description" value={view.description} onChange={(value) => onChange(view.id, { description: value })} />
                      <TextField label="Orientation" value={view.orientation} onChange={(value) => onChange(view.id, { orientation: value })} />
                      <TextField label="Inspection Zone" value={view.inspectionZone} onChange={(value) => onChange(view.id, { inspectionZone: value })} />
                      <TextField
                        label="Reference Attachment ID"
                        value={view.referenceAttachmentId}
                        onChange={(value) => onChange(view.id, { referenceAttachmentId: value })}
                        placeholder="Controlled drawing, sketch, or attachment"
                      />
                    </div>
                  </section>

                  <div className="border-t border-border/70 pt-5">
                    <RtFilmExposureFields
                      data={view}
                      source={source}
                      ps811000Applicable={ps811000Applicable}
                      onChange={(patch) => onChange(view.id, patch)}
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
