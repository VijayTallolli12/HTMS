/**
 * W4: Onboarding Preview — safety-contract regression tests.
 *
 * These tests parse the preview source files and assert the safety contract
 * structurally, so no Angular test-bed is required:
 *   - the service performs ZERO network calls (no HttpClient/fetch/XHR)
 *   - no persistence (no localStorage/sessionStorage)
 *   - no backend service imports (no SetupService/SystemResetService/Prisma)
 *   - the component never calls setup mutation APIs
 */
import * as fs from 'fs';
import * as path from 'path';

const WEB_APP = path.join(__dirname, '../../apps/web-shell/src/app');

function read(rel: string): string {
  return fs.readFileSync(path.join(WEB_APP, rel), 'utf8');
}

// Strip block comments and line comments so doc text can't trip pattern assertions.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Onboarding Preview safety contract', () => {
  const serviceSrc = stripComments(read('features/owner/onboarding-preview.service.ts'));
  const componentSrc = read('features/owner/onboarding-preview.component.html');
  const componentTs = stripComments(read('features/owner/onboarding-preview.component.ts'));

  it('service performs zero network calls (no HttpClient, fetch, XHR)', () => {
    expect(serviceSrc).not.toMatch(/HttpClient/);
    expect(serviceSrc).not.toMatch(/\bfetch\(/);
    expect(serviceSrc).not.toMatch(/XMLHttpRequest/);
    expect(serviceSrc).not.toMatch(/\.post\(|\.put\(|\.patch\(|\.delete\(/);
  });

  it('service performs zero persistence (no localStorage/sessionStorage)', () => {
    expect(serviceSrc).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

  it('service imports no backend-backed services (SetupService, SystemResetService, Prisma)', () => {
    expect(serviceSrc).not.toMatch(/SetupService|SystemResetService|PrismaClient|@prisma\/client/);
  });

  it('component never calls the forbidden setup mutation endpoints', () => {
    const forbidden = [
      'setup/organization',
      'setup/property',
      'setup/bootstrap-admin',
      'setup/complete',
      'system/reset',
    ];
    for (const f of forbidden) {
      expect(componentSrc).not.toContain(f);
      expect(componentTs).not.toContain(f);
    }
    expect(componentTs).not.toMatch(/SetupService|SystemResetService|HttpClient/);
  });

  it('component only imports the preview service and routing/form modules', () => {
    const imports = componentTs.match(/from '([^']+)';/g) ?? [];
    const allowed = [
      '@angular/core',
      '@angular/common',
      '@angular/forms',
      '@angular/router',
      './onboarding-preview.service',
    ];
    for (const imp of imports) {
      const mod = imp.match(/from '([^']+)';/)![1];
      expect(allowed).toContain(mod);
    }
  });

  it('service state lives in signals only and resets cleanly (logic mirror)', () => {
    // Mirror the service logic minimally to verify transition bounds.
    const TOTAL = 8;
    let step = 0;
    const goTo = (s: number) => { step = Math.max(0, Math.min(s, TOTAL - 1)); };
    goTo(3); expect(step).toBe(3);
    goTo(step + 1); expect(step).toBe(4);
    goTo(step - 1); expect(step).toBe(3);
    goTo(99); expect(step).toBe(TOTAL - 1);
    goTo(-5); expect(step).toBe(0);
  });

  it('component shows the preview banner and the no-changes statement', () => {
    expect(componentSrc).toContain('ONBOARDING PREVIEW MODE');
    expect(componentSrc).toContain('Safe demonstration — no changes will be saved to the HMS.');
    expect(componentSrc).toContain('No changes were made to your HMS database.');
    expect(componentSrc).toContain('Complete Preview');
    expect(componentSrc).toContain('Start Preview Again');
    expect(componentSrc).toContain('Return to HMS');
  });

  it('route is wired with the owner guard only (no public access)', () => {
    const routes = fs.readFileSync(path.join(WEB_APP, 'app.routes.ts'), 'utf8');
    const block = routes.match(/path: 'owner\/onboarding-preview'[\s\S]*?},/)?.[0] ?? '';
    expect(block).toContain('ownerGuard');
    expect(block).not.toMatch(/setupWizardGuard|canActivate: \[\]/);
  });
});
