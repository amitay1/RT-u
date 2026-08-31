import type { RtDigitalAttachmentMetadata } from '@/types/rtDigital';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';
import {
  createRtPtAssetDataUrl,
  getRtPtAsset,
  isRtPtAssetStoreAvailable,
} from '@/lib/rtPtAssetStore';

/**
 * Pre-loaded attachment images for the controlled technique PDF.
 *
 * The PDF builder stays synchronous and deterministic: callers load image
 * bytes from the local asset store BEFORE building, and the builder embeds
 * only what it is handed. An attachment is embedded only when the stored
 * blob still matches the SHA-256 recorded in the controlled document —
 * otherwise the PDF keeps the metadata row alone, never a wrong image.
 * PDF-type attachments are never embedded; they remain metadata rows.
 */

export interface RtPtPdfAttachmentImage {
  metadata: RtDigitalAttachmentMetadata;
  /** data: URL suitable for jsPDF addImage. */
  dataUrl: string;
  widthPx: number;
  heightPx: number;
}

export type RtPtPdfAttachmentImageMap = ReadonlyMap<string, RtPtPdfAttachmentImage>;

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

/**
 * Image attachments referenced by the controlled document, in document order,
 * unique by attachment ID. Only RT-Digital carries attachment metadata today.
 */
export const collectRtPtTechniqueImageAttachments = (
  document: RtPtDocumentV3,
): RtDigitalAttachmentMetadata[] => {
  if (document.method !== 'RT-Digital') {
    return [];
  }
  const seen = new Set<string>();
  const collected: RtDigitalAttachmentMetadata[] = [];
  const add = (metadata: RtDigitalAttachmentMetadata | null | undefined): void => {
    if (!metadata || !IMAGE_MIME_TYPES.has(metadata.mimeType) || seen.has(metadata.id)) {
      return;
    }
    seen.add(metadata.id);
    collected.push(metadata);
  };
  document.technique.planning?.part.attachments.forEach(add);
  document.technique.acquisitions.forEach((acquisition) => add(acquisition.plan?.representativeImage));
  return collected;
};

const measureImageDimensions = async (blob: Blob): Promise<{ widthPx: number; heightPx: number } | null> => {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const bitmap = await globalThis.createImageBitmap(blob);
      const dimensions = { widthPx: bitmap.width, heightPx: bitmap.height };
      bitmap.close();
      return dimensions.widthPx > 0 && dimensions.heightPx > 0 ? dimensions : null;
    } catch {
      // Fall through to the Image-element path below.
    }
  }
  if (typeof Image === 'undefined' || typeof globalThis.URL?.createObjectURL !== 'function') {
    return null;
  }
  return new Promise((resolve) => {
    const url = globalThis.URL.createObjectURL(blob);
    const image = new Image();
    const settle = (value: { widthPx: number; heightPx: number } | null): void => {
      globalThis.URL.revokeObjectURL(url);
      resolve(value);
    };
    image.onload = () => settle(
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? { widthPx: image.naturalWidth, heightPx: image.naturalHeight }
        : null,
    );
    image.onerror = () => settle(null);
    image.src = url;
  });
};

/**
 * Loads the referenced image attachments from the local asset store. Assets
 * that are missing, unreadable, integrity-mismatched against the document's
 * recorded SHA-256, or undecodable are silently skipped — the PDF then shows
 * their metadata rows only. Never throws for per-asset failures.
 */
export async function loadRtPtTechniquePdfAttachmentImages(
  document: RtPtDocumentV3,
): Promise<Map<string, RtPtPdfAttachmentImage>> {
  const images = new Map<string, RtPtPdfAttachmentImage>();
  if (!isRtPtAssetStoreAvailable()) {
    return images;
  }
  for (const metadata of collectRtPtTechniqueImageAttachments(document)) {
    try {
      const asset = await getRtPtAsset(metadata.id);
      if (!asset || asset.metadata.sha256 !== metadata.sha256) {
        continue;
      }
      const dimensions = await measureImageDimensions(asset.blob);
      if (!dimensions) {
        continue;
      }
      images.set(metadata.id, {
        metadata,
        dataUrl: await createRtPtAssetDataUrl(asset.blob),
        widthPx: dimensions.widthPx,
        heightPx: dimensions.heightPx,
      });
    } catch {
      // A failed asset never blocks the export; the PDF keeps metadata rows.
    }
  }
  return images;
}
