const MAX_RTPT_PDF_BYTES = 32 * 1024 * 1024;
const RTPT_PDF_FILENAME_PATTERN = /^(?:(?:DRAFT|SUPERSEDED)-UNCONTROLLED-)?RTPT-[A-Za-z0-9._-]+\.pdf$/;

class RtPtPdfSavePayloadError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'RtPtPdfSavePayloadError';
    this.reason = reason;
  }
}

function decodeRtPtPdfSavePayload(payload, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_RTPT_PDF_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 8) {
    throw new TypeError('maxBytes must be a safe integer of at least 8 bytes.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RtPtPdfSavePayloadError('The PDF save request is malformed.', 'payload-invalid');
  }

  const keys = Object.keys(payload).sort();
  if (keys.length !== 2 || keys[0] !== 'data' || keys[1] !== 'filename') {
    throw new RtPtPdfSavePayloadError('The PDF save request contains unexpected fields.', 'payload-shape-invalid');
  }

  const { data, filename } = payload;
  if (typeof filename !== 'string' || !RTPT_PDF_FILENAME_PATTERN.test(filename)) {
    throw new RtPtPdfSavePayloadError('The RT/PT PDF filename is invalid.', 'filename-invalid');
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new RtPtPdfSavePayloadError('The RT/PT PDF payload is empty.', 'pdf-empty');
  }

  const maximumBase64Length = Math.ceil(maxBytes / 3) * 4;
  if (data.length > maximumBase64Length) {
    throw new RtPtPdfSavePayloadError('The RT/PT PDF exceeds the permitted size.', 'pdf-too-large');
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    throw new RtPtPdfSavePayloadError('The RT/PT PDF payload is not valid base64.', 'pdf-base64-invalid');
  }

  const buffer = Buffer.from(data, 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new RtPtPdfSavePayloadError(
      buffer.length === 0 ? 'The RT/PT PDF payload is empty.' : 'The RT/PT PDF exceeds the permitted size.',
      buffer.length === 0 ? 'pdf-empty' : 'pdf-too-large',
    );
  }
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new RtPtPdfSavePayloadError('The save request does not contain a PDF document.', 'pdf-signature-invalid');
  }

  return { buffer, filename };
}

module.exports = {
  MAX_RTPT_PDF_BYTES,
  RTPT_PDF_FILENAME_PATTERN,
  RtPtPdfSavePayloadError,
  decodeRtPtPdfSavePayload,
};
