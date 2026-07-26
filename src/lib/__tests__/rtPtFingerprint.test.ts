import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createRtPtSha256Fingerprint,
  isRtPtSha256Fingerprint,
} from '@/lib/rtPtFingerprint';

describe('RT/PT SHA-256 fingerprints', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ])('matches the standard SHA-256 vector for %j', (value, digest) => {
    expect(createRtPtSha256Fingerprint(value)).toBe(`sha256:${digest}`);
  });

  it('uses stable UTF-8 encoding across the portable and Node implementations', () => {
    const value = 'RT/PT controlled content — טכניקה';
    const nodeDigest = createHash('sha256').update(value, 'utf8').digest('hex');

    const fingerprint = createRtPtSha256Fingerprint(value);

    expect(fingerprint).toBe(`sha256:${nodeDigest}`);
    expect(isRtPtSha256Fingerprint(fingerprint)).toBe(true);
    expect(isRtPtSha256Fingerprint(nodeDigest)).toBe(false);
  });
});
