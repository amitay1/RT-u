import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string => fs.readFileSync(
  path.join(process.cwd(), relativePath),
  'utf8',
);

describe('RT/PT build surface', () => {
  const viteConfig = read('vite.config.ts');
  const gitignore = read('.gitignore');
  const serverEntry = read('server/index.ts');
  const electronMain = read('electron/main.cjs');
  const builder = JSON.parse(read('electron-builder.json')) as {
    files: string[];
    asarUnpack: string[];
  };
  const serviceWorker = read('public/rtpt/service-worker-advanced.js');

  it('copies only RT/PT public assets and binds the dev server to loopback', () => {
    expect(viteConfig).toContain('public/rtpt');
    expect(viteConfig).toContain('host: "127.0.0.1"');
    expect(viteConfig).not.toContain('host: "0.0.0.0"');
    expect(viteConfig).not.toContain("'three-vendor'");
    expect(viteConfig).not.toContain("'drawing-vendor'");
  });

  it('uses only the dedicated RT/PT production renderer output', () => {
    expect(viteConfig).toContain('outDir: path.resolve(__dirname, "./rtpt-dist")');
    expect(gitignore.split(/\r?\n/)).toContain('rtpt-dist');
    expect(serverEntry).toContain('path.join(process.cwd(), "rtpt-dist")');
    expect(serverEntry).not.toContain('path.join(process.cwd(), "dist")');
    expect(electronMain).toContain("path.join(__dirname, '..', 'rtpt-dist')");
    expect(electronMain).toContain("path.join(process.resourcesPath, 'app.asar.unpacked', 'rtpt-dist')");
    expect(electronMain).not.toMatch(/path\.join\([^\n]+['"]dist['"]\)/);
    expect(builder.files.filter((pattern) =>
      !pattern.startsWith('!') && /(^|\/)(?:rtpt-)?dist(\/|$)/i.test(pattern)
    )).toEqual(['rtpt-dist/**/*']);
    expect(builder.asarUnpack).toEqual(['rtpt-dist/**/*']);
  });

  it('never caches API requests or non-GET requests', () => {
    expect(serviceWorker).toContain("request.method !== 'GET'");
    expect(serviceWorker).toContain("url.pathname.startsWith('/api/')");
    expect(serviceWorker).not.toContain('/api/standards');
    expect(serviceWorker).not.toContain('scanmaster');
  });
});
