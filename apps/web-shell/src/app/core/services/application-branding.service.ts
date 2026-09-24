import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';
import { BrandAssetService, BrandAsset } from './brand-asset.service';

export interface ApplicationBranding {
  applicationName: string;
  applicationSubtitle: string;
  shortName: string;
  useCustomBrandMark: boolean;
  customBrandMark: string;
}

export const DEFAULT_BRANDING: ApplicationBranding = {
  applicationName: 'Folkslogic HTMS',
  applicationSubtitle: 'Hotel Management System',
  shortName: 'HTMS',
  useCustomBrandMark: false,
  customBrandMark: '',
};

export const BRANDING_STORAGE_KEY = 'hms_application_branding';

const CONNECTOR_WORDS = new Set([
  'the',
  'and',
  'of',
  'for',
  'a',
  'an',
  'in',
  'on',
  'at',
  'to',
  'by',
  'with',
  '&',
  '-',
]);

/**
 * Deterministic brand initials generator:
 * 1. Filter out connector words ('the', 'and', 'of', 'for', '&', etc.).
 * 2. If >= 2 meaningful words: first char of 1st word + first char of 2nd word.
 *    Examples:
 *      "Folkslogic HTMS" -> "FH"
 *      "Tokyo Grandeur HTMS" -> "TG"
 *      "Global Luxury Resorts" -> "GL"
 *      "Royal Palm Hotels" -> "RP"
 * 3. If 1 meaningful word:
 *    - If distinct shortName provided: first char of word + first char of shortName (e.g. "Folkslogic" + "HTMS" -> "FH").
 *    - Otherwise: single initial (do NOT duplicate to "FO").
 * 4. Maximum: 2 characters, uppercase.
 */
export function getBrandInitials(applicationName: string, shortName?: string): string {
  if (!applicationName || !applicationName.trim()) {
    return 'FH';
  }

  const rawWords = applicationName.trim().split(/[\s_\-/\\|:]+/).filter(Boolean);
  const meaningfulWords = rawWords.filter((w) => !CONNECTOR_WORDS.has(w.toLowerCase()));

  if (meaningfulWords.length >= 2) {
    const firstChar = meaningfulWords[0].charAt(0).toUpperCase();
    const secondChar = meaningfulWords[1].charAt(0).toUpperCase();
    return `${firstChar}${secondChar}`;
  }

  if (meaningfulWords.length === 1) {
    const firstChar = meaningfulWords[0].charAt(0).toUpperCase();
    if (shortName && shortName.trim()) {
      const shortWords = shortName.trim().split(/[\s_\-/\\|:]+/).filter(Boolean);
      const meaningfulShort = shortWords.filter((w) => !CONNECTOR_WORDS.has(w.toLowerCase()));
      if (meaningfulShort.length > 0) {
        const shortChar = meaningfulShort[0].charAt(0).toUpperCase();
        if (shortChar !== firstChar) {
          return `${firstChar}${shortChar}`;
        }
      }
    }
    return firstChar;
  }

  return 'FH';
}

/**
 * Generates an SVG Data URI favicon representing the brand mark.
 */
export function generateFallbackFaviconSvg(
  mark: string,
  bgColor: string = '#0F172A',
  textColor: string = '#FDF8EE',
  strokeColor: string = '#9A7B38',
): string {
  const safeMark = (mark || 'FH').substring(0, 4);
  const fontSize = safeMark.length <= 2 ? 26 : safeMark.length === 3 ? 20 : 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect x="2" y="2" width="60" height="60" rx="14" fill="${bgColor}" stroke="${strokeColor}" stroke-width="2"/>
    <text x="50%" y="54%" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="700" fill="${textColor}" text-anchor="middle" dominant-baseline="middle" letter-spacing="0.5">${safeMark}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Updates or creates the <link rel="icon"> element in the document head.
 */
export function applyFaviconToDocument(href: string, type: string = 'image/svg+xml'): void {
  if (typeof document === 'undefined') return;
  let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = type;
  link.href = href;
}

@Injectable({
  providedIn: 'root',
})
export class ApplicationBrandingService {
  private readonly titleService = inject(Title);
  private readonly assetService = inject(BrandAssetService);

  private readonly brandingState = signal<ApplicationBranding>(this.loadBranding());
  private readonly currentPageTitle = signal<string>('');

  readonly logoAsset = signal<BrandAsset | null>(null);
  readonly faviconAsset = signal<BrandAsset | null>(null);
  readonly isAssetsLoaded = signal<boolean>(false);

  readonly branding = computed(() => this.brandingState());
  readonly applicationName = computed(() => this.brandingState().applicationName);
  readonly applicationSubtitle = computed(() => this.brandingState().applicationSubtitle);
  readonly shortName = computed(() => this.brandingState().shortName);
  readonly useCustomBrandMark = computed(() => this.brandingState().useCustomBrandMark);
  readonly customBrandMark = computed(() => this.brandingState().customBrandMark);

  /**
   * Deterministic dynamic brand mark:
   * Uses custom mark if enabled and valid, otherwise computed initials.
   */
  readonly brandMark = computed(() => {
    const state = this.brandingState();
    if (state.useCustomBrandMark && state.customBrandMark && state.customBrandMark.trim().length > 0) {
      return state.customBrandMark.trim().toUpperCase().substring(0, 4);
    }
    return getBrandInitials(state.applicationName, state.shortName);
  });

  /**
   * Alias for brandMark for backward compatibility with existing components
   */
  readonly logoMark = computed(() => this.brandMark());

  constructor() {
    this.initAssets();

    // Keep browser document title in sync with applicationName and current route title
    effect(() => {
      this.syncDocumentTitle();
    });

    // Keep browser favicon in sync with active brand mark / uploaded favicon
    effect(() => {
      this.syncFavicon();
    });
  }

  private async initAssets(): Promise<void> {
    try {
      const [logo, favicon] = await Promise.all([
        this.assetService.getAsset('logo'),
        this.assetService.getAsset('favicon'),
      ]);
      this.logoAsset.set(logo);
      this.faviconAsset.set(favicon);
      this.isAssetsLoaded.set(true);
      this.syncFavicon();
    } catch {
      this.isAssetsLoaded.set(true);
    }
  }

  setPageTitle(pageTitle: string): void {
    this.currentPageTitle.set(pageTitle);
    this.syncDocumentTitle();
  }

  updateBranding(partial: Partial<ApplicationBranding>): void {
    const current = this.brandingState();
    const updated: ApplicationBranding = {
      applicationName:
        partial.applicationName !== undefined && partial.applicationName.trim()
          ? partial.applicationName.trim()
          : current.applicationName,
      applicationSubtitle:
        partial.applicationSubtitle !== undefined && partial.applicationSubtitle.trim()
          ? partial.applicationSubtitle.trim()
          : current.applicationSubtitle,
      shortName:
        partial.shortName !== undefined && partial.shortName.trim()
          ? partial.shortName.trim()
          : current.shortName,
      useCustomBrandMark:
        partial.useCustomBrandMark !== undefined
          ? partial.useCustomBrandMark
          : current.useCustomBrandMark,
      customBrandMark:
        partial.customBrandMark !== undefined
          ? partial.customBrandMark.trim().toUpperCase().substring(0, 4)
          : current.customBrandMark,
    };

    this.brandingState.set(updated);
    this.persist(updated);
    this.syncDocumentTitle();
    this.syncFavicon();
  }

  async uploadLogo(file: File): Promise<BrandAsset> {
    const asset = await this.assetService.processLogoFile(file);
    this.logoAsset.set(asset);
    return asset;
  }

  async removeLogo(): Promise<void> {
    await this.assetService.removeAsset('logo');
    this.logoAsset.set(null);
  }

  async uploadFavicon(file: File): Promise<BrandAsset> {
    const asset = await this.assetService.processFaviconFile(file);
    this.faviconAsset.set(asset);
    this.syncFavicon();
    return asset;
  }

  async removeFavicon(): Promise<void> {
    await this.assetService.removeAsset('favicon');
    this.faviconAsset.set(null);
    this.syncFavicon();
  }

  async resetToDefault(): Promise<void> {
    this.brandingState.set({ ...DEFAULT_BRANDING });
    try {
      localStorage.removeItem(BRANDING_STORAGE_KEY);
    } catch {}

    try {
      await this.assetService.clearAll();
    } catch {}

    this.logoAsset.set(null);
    this.faviconAsset.set(null);

    this.syncDocumentTitle();
    this.syncFavicon();
  }

  syncFavicon(): void {
    const customFavicon = this.faviconAsset();
    if (customFavicon && customFavicon.dataUrl) {
      applyFaviconToDocument(customFavicon.dataUrl, customFavicon.mimeType);
      return;
    }

    // Dynamic generated fallback favicon using current brand mark
    const mark = this.brandMark();
    const fallbackSvg = generateFallbackFaviconSvg(mark);
    applyFaviconToDocument(fallbackSvg, 'image/svg+xml');
  }

  private syncDocumentTitle(): void {
    const appName = this.applicationName();
    const pageTitle = this.currentPageTitle();
    if (pageTitle && pageTitle.trim().length > 0) {
      this.titleService.setTitle(`${appName} — ${pageTitle.trim()}`);
    } else {
      this.titleService.setTitle(appName);
    }
  }

  private loadBranding(): ApplicationBranding {
    try {
      const stored = localStorage.getItem(BRANDING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.applicationName === 'string') {
          return {
            applicationName: parsed.applicationName.trim() || DEFAULT_BRANDING.applicationName,
            applicationSubtitle:
              parsed.applicationSubtitle !== undefined
                ? parsed.applicationSubtitle.trim()
                : DEFAULT_BRANDING.applicationSubtitle,
            shortName:
              parsed.shortName !== undefined
                ? parsed.shortName.trim()
                : DEFAULT_BRANDING.shortName,
            useCustomBrandMark: Boolean(parsed.useCustomBrandMark),
            customBrandMark: parsed.customBrandMark ? parsed.customBrandMark.trim().toUpperCase().substring(0, 4) : '',
          };
        }
      }
    } catch {}
    return { ...DEFAULT_BRANDING };
  }

  private persist(branding: ApplicationBranding): void {
    try {
      localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
    } catch {}
  }
}

@Injectable({
  providedIn: 'root',
})
export class AppTitleStrategy extends TitleStrategy {
  private readonly branding = inject(ApplicationBrandingService);

  override updateTitle(routerState: RouterStateSnapshot): void {
    const rawTitle = this.buildTitle(routerState);
    if (rawTitle && rawTitle.trim().length > 0) {
      const trimmed = rawTitle.trim();
      if (trimmed.toLowerCase() === 'sign in' || trimmed.toLowerCase() === 'login') {
        this.branding.setPageTitle('');
      } else {
        this.branding.setPageTitle(trimmed);
      }
    } else {
      this.branding.setPageTitle('');
    }
  }
}
