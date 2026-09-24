import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';

export interface ApplicationBranding {
  applicationName: string;
  applicationSubtitle: string;
  shortName: string;
  logoMark: string;
}

export const DEFAULT_BRANDING: ApplicationBranding = {
  applicationName: 'Folkslogic HTMS',
  applicationSubtitle: 'Hotel Management System',
  shortName: 'HTMS',
  logoMark: 'HM',
};

export const BRANDING_STORAGE_KEY = 'hms_application_branding';

@Injectable({
  providedIn: 'root',
})
export class ApplicationBrandingService {
  private readonly titleService = inject(Title);

  private readonly brandingState = signal<ApplicationBranding>(this.loadBranding());
  private readonly currentPageTitle = signal<string>('');

  readonly branding = computed(() => this.brandingState());
  readonly applicationName = computed(() => this.brandingState().applicationName);
  readonly applicationSubtitle = computed(() => this.brandingState().applicationSubtitle);
  readonly shortName = computed(() => this.brandingState().shortName);
  readonly logoMark = computed(() => this.brandingState().logoMark);

  constructor() {
    // Keep browser document title in sync with applicationName and current route title
    effect(() => {
      this.syncDocumentTitle();
    });
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
      logoMark:
        partial.logoMark !== undefined && partial.logoMark.trim()
          ? partial.logoMark.trim()
          : current.logoMark,
    };

    this.brandingState.set(updated);
    this.persist(updated);
    this.syncDocumentTitle();
  }

  resetToDefault(): void {
    this.brandingState.set({ ...DEFAULT_BRANDING });
    try {
      localStorage.removeItem(BRANDING_STORAGE_KEY);
    } catch {}
    this.syncDocumentTitle();
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
            applicationSubtitle: parsed.applicationSubtitle?.trim() || DEFAULT_BRANDING.applicationSubtitle,
            shortName: parsed.shortName?.trim() || DEFAULT_BRANDING.shortName,
            logoMark: parsed.logoMark?.trim() || DEFAULT_BRANDING.logoMark,
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

