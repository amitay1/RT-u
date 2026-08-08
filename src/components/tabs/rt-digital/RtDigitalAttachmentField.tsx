import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, FileImage, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  createRtPtAssetObjectUrl,
  getRtPtAsset,
  putRtPtAsset,
  revokeRtPtAssetObjectUrl,
} from '@/lib/rtPtAssetStore';
import type { RtDigitalAttachmentMetadata } from '@/types/rtDigital';

interface RtDigitalAttachmentFieldProps {
  label: string;
  value: RtDigitalAttachmentMetadata[];
  onChange: (value: RtDigitalAttachmentMetadata[]) => void;
  multiple?: boolean;
  description?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const readableError = (error: unknown): string => (
  error instanceof Error ? error.message : 'The attachment operation failed.'
);

/**
 * Stores attachment bytes in the RT/PT IndexedDB asset store and emits metadata only.
 * Removing an item removes the document reference after confirmation; bytes are retained
 * because another field or document may still reference the same immutable asset ID.
 */
export function RtDigitalAttachmentField({
  label,
  value,
  onChange,
  multiple = true,
  description,
}: RtDigitalAttachmentFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const [removeCandidate, setRemoveCandidate] = useState<RtDigitalAttachmentMetadata | null>(null);
  const attachmentKey = value
    .map((metadata) => `${metadata.id}:${metadata.sha256}:${metadata.size}:${metadata.mimeType}`)
    .join('|');
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    const attachments = valueRef.current;

    setObjectUrls({});
    setUnavailableIds(new Set());
    void Promise.all(attachments.map(async (metadata) => {
      try {
        const asset = await getRtPtAsset(metadata.id);
        if (
          !asset
          || asset.metadata.sha256 !== metadata.sha256
          || asset.metadata.size !== metadata.size
          || asset.metadata.mimeType !== metadata.mimeType
        ) {
          if (active) {
            setUnavailableIds((current) => new Set(current).add(metadata.id));
          }
          return;
        }
        const objectUrl = createRtPtAssetObjectUrl(asset.blob);
        urls.push(objectUrl);
        if (active) {
          setObjectUrls((current) => ({ ...current, [metadata.id]: objectUrl }));
        } else {
          revokeRtPtAssetObjectUrl(objectUrl);
        }
      } catch {
        if (active) {
          setUnavailableIds((current) => new Set(current).add(metadata.id));
        }
      }
    }));

    return () => {
      active = false;
      urls.forEach(revokeRtPtAssetObjectUrl);
    };
  }, [attachmentKey]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    const metadata: RtDigitalAttachmentMetadata[] = [];
    try {
      const selectedFiles = multiple ? Array.from(files) : [files[0]];
      for (const file of selectedFiles) {
        metadata.push(await putRtPtAsset(file));
      }
      onChange(multiple ? [...value, ...metadata] : metadata.slice(-1));
    } catch (uploadError) {
      if (metadata.length > 0) {
        onChange(multiple ? [...value, ...metadata] : metadata.slice(-1));
      }
      setError(readableError(uploadError));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const confirmRemove = () => {
    if (!removeCandidate) return;
    onChange(value.filter((attachment) => attachment.id !== removeCandidate.id));
    setRemoveCandidate(null);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/15 p-4 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label htmlFor={inputId} className="text-sm font-semibold">{label}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {description ?? 'JPG, PNG, or PDF. Attachment bytes remain outside the controlled technique document.'}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Storing…' : multiple ? 'Add files' : value.length ? 'Replace file' : 'Add file'}
        </Button>
        <input
          ref={inputRef}
          id={inputId}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
          multiple={multiple}
          disabled={uploading}
          onChange={(event) => void uploadFiles(event.target.files)}
        />
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No attachment metadata recorded.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {value.map((metadata) => {
            const objectUrl = objectUrls[metadata.id];
            const isPdf = metadata.mimeType === 'application/pdf';
            return (
              <article key={metadata.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
                <div className="flex h-36 items-center justify-center border-b border-border bg-muted/25">
                  {objectUrl && !isPdf ? (
                    <img
                      src={objectUrl}
                      alt={`Preview of ${metadata.name}`}
                      className="h-full w-full object-contain"
                    />
                  ) : objectUrl && isPdf ? (
                    <iframe src={objectUrl} title={`Preview of ${metadata.name}`} className="h-full w-full" />
                  ) : isPdf ? (
                    <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <FileImage className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={metadata.name}>{metadata.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{isPdf ? 'PDF' : metadata.mimeType === 'image/png' ? 'PNG' : 'JPG'}</Badge>
                        <span className="text-xs text-muted-foreground">{formatBytes(metadata.size)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {objectUrl ? (
                        <Button type="button" size="icon" variant="ghost" asChild>
                          <a href={objectUrl} target="_blank" rel="noreferrer" aria-label={`Open ${metadata.name}`}>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Remove ${metadata.name}`}
                        onClick={() => setRemoveCandidate(metadata)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {unavailableIds.has(metadata.id) ? (
                    <p className="text-xs text-destructive">Stored bytes are unavailable in this browser profile.</p>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">SHA-256</span>
                    <code className="mt-1 block break-all font-mono text-[10px] leading-4">{metadata.sha256}</code>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={Boolean(removeCandidate)} onOpenChange={(open) => !open && setRemoveCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove attachment reference?</AlertDialogTitle>
            <AlertDialogDescription>
              This explicitly removes {removeCandidate?.name ?? 'the attachment'} from this document field. Its stored bytes
              are retained so another acquisition or document reference is not broken.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmRemove}>Remove reference</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
