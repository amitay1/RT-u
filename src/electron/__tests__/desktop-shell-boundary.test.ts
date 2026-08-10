import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readWorkspaceFile = (relativePath: string): string => (
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
);

describe('RT/PT desktop shell boundary', () => {
  const main = readWorkspaceFile('electron/main.cjs');
  const preload = readWorkspaceFile('electron/preload.cjs');
  const rtPtLicenseService = readWorkspaceFile('electron/rtpt-license-service.cjs');
  const builder = JSON.parse(readWorkspaceFile('electron-builder.json')) as { files: string[] };

  it('does not expose legacy license or MRO capabilities', () => {
    expect(main).not.toMatch(/LicenseManager|license:|SCANMASTER_MRO_DIR|mro-assets/);
    expect(preload).not.toMatch(/license:|\blicense\s*:/);
    expect(main).not.toContain("'/api/standards");
    expect(main).not.toMatch(/claude:|VITE_ANTHROPIC_API_KEY|NDT_PROMPT/);
    expect(preload).not.toMatch(/claude:/);
  });

  it('wires the independent RT/PT license boundary fail-closed', () => {
    expect(main).toContain("require('./rtpt-license-service.cjs')");
    expect(main).toContain('safeStorage');
    expect(main).toContain("path.join(__dirname, 'rtpt-license-public-key.pem')");
    expect(main).toContain('RTPT_LICENSE_PUBLIC_KEY_PATH');
    expect(main).toContain('!app.isPackaged');
    expect(main).toContain("'rtpt-license-get-status'");
    expect(main).toContain("'rtpt-license-activate'");
    expect(main).toContain("'rtpt-license-deactivate'");
    expect(main).toContain('assertActiveRtPtLicense();');
    expect(main).toContain("session.defaultSession.on('will-download'");
    expect(main).toContain('Blocked a renderer download while the license was inactive.');
    expect(main).toContain("decodeRtPtPdfSavePayload(payload)");
    expect(preload).toContain("savePDF: (data, filename) => ipcRenderer.invoke('save-pdf'");
    const pdfSaveHandler = main.slice(
      main.indexOf("ipcMain.handle('save-pdf'"),
      main.indexOf("// ==========================================", main.indexOf("ipcMain.handle('save-pdf'")),
    );
    expect(pdfSaveHandler.match(/assertActiveRtPtLicense\(\);/g)).toHaveLength(2);
    expect(main).toContain("label: 'License Information'");
    expect(main).toContain('showRtPtLicenseInformation');
    expect(main).toContain("'/api/technique-sheets'");
    expect(main).toContain("'/api/organizations'");
    expect(main).toContain("'/api/inspector-profiles'");
    expect(main).toContain("'/api/unified-storage'");
    expect(main).toContain("expressApp.post('/api/logs'");
    expect(preload).toContain('rtPtLicenseBridge');
    expect(preload).toContain('rtptLicense: rtPtLicenseBridge');
    expect(rtPtLicenseService).toContain("const PRODUCT = 'rt-pt-inspector'");
    expect(rtPtLicenseService).toContain("const APP_ID = 'com.amitay.rtptinspector'");
    expect(rtPtLicenseService).not.toContain('update-public-key.pem');
  });

  it('does not retain orphaned desktop IPC channels', () => {
    const source = `${main}\n${preload}`;
    for (const channel of [
      'new-sheet',
      'export-pdf',
      'download-complete',
      'display-info',
      'window-resized',
      'get-update-settings',
      'set-update-settings',
    ]) {
      expect(source).not.toContain(channel);
    }
  });

  it('keeps the hardened local application and offline-update boundaries', () => {
    expect(main).toContain("const EMBEDDED_SERVER_HOST = '127.0.0.1'");
    expect(main).toContain('sandbox: true');
    expect(main).toContain('assertTrustedIpcSender');
    expect(main).toContain('loadOfflineUpdatePublicKey');
    expect(main).toContain("new Set(['https:', 'mailto:'])");
    expect(main).not.toContain("['https:', 'http:', 'mailto:']");
    expect(main).not.toContain("appendSwitch('no-sandbox')");
    expect(main).not.toContain("appendSwitch('disable-gpu-sandbox')");
    expect(main).not.toContain("connect-src 'self' https:");
    expect(main).not.toContain("img-src 'self' data: blob: https:");
  });

  it('persists renderer storage independently of the random embedded-server port', () => {
    expect(main).toContain("path.join(dataDir, 'unified-storage')");
    expect(main).toContain("expressApp.get('/api/unified-storage/health'");
    expect(main).toContain("expressApp.get('/api/unified-storage/:key'");
    expect(main).toContain("expressApp.post('/api/unified-storage/:key'");
    expect(main).toContain("expressApp.delete('/api/unified-storage/:key'");
    expect(main).toContain("'rtpt_inspector_profiles'");
    expect(main).toContain('validUnifiedStorageKeys.has(key)');
  });

  it('allows the inactive activation gate to quit without bypassing active-workspace confirmation', () => {
    expect(main).toMatch(/ipcMain\.handle\('app-quit', \(event\) => \{\s+assertTrustedIpcSender\(event\);/);
    expect(main).toContain('const licenseIsActive = getRtPtLicenseStatus().active === true;');
    expect(main).toContain('if (!licenseIsActive) closeApproved = true;');
    expect(main).toContain('pendingWorkspaceConfirmation: licenseIsActive');
    expect(main).toMatch(/ipcMain\.handle\('confirm-app-close', \(event\) => \{\s+assertTrustedIpcSender\(event\);/);
  });

  it('trust-checks renderer requests before applying window or external-shell controls', () => {
    for (const channel of [
      'window-minimize',
      'window-maximize',
      'app-quit',
      'confirm-app-close',
      'open-external-url',
    ]) {
      const escapedChannel = channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(main).toMatch(new RegExp(
        `ipcMain\\.handle\\('${escapedChannel}', (?:async )?\\(event(?:, [^)]*)?\\) => \\{\\s+assertTrustedIpcSender\\(event\\);`,
      ));
    }
  });

  it('packages only the runtime surface needed by the desktop shell', () => {
    expect(builder.files).toContain('build/icon.png');
    expect(builder.files).toContain('!electron/license-manager.cjs');
    expect(builder.files).not.toContain('server/**/*');
    expect(builder.files).not.toContain('shared/**/*');
  });

  it('rejects non-RT/PT documents at the embedded persistence boundary', () => {
    expect(main).toContain("value.documentKind === 'rtpt-document'");
    expect(main).toContain('value.schemaVersion === 3');
    expect(main).toContain('value.schemaVersion === 2');
    expect(main).toContain('value.schemaVersion === 1');
    expect(main).toContain('Array.isArray(value.revisionHistory)');
    expect(main).toContain('Array.isArray(technique.exposureViews)');
    expect(main).toContain('Array.isArray(technique.acquisitions)');
    expect(main).toContain("'removal'");
    expect(main).toContain('return isRtPtDocumentV3(value);');
    expect(main).toContain('Only RT/PT Inspector documents are supported');
    expect(main).toContain('data.filter((sheet) => isReadableRtPtDocument(sheet?.data))');
    expect(main).toContain('if (!isWritableRtPtDocument(req.body?.data))');
  });
});
