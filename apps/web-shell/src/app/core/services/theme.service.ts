import { Injectable, signal, computed } from '@angular/core';

export interface ThemeColors {
  text: string;
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  border: string;
  mutedText: string;
  focus: string;
}

export type ThemePreset = 'premium-hospitality' | 'classic-hotel' | 'modern-slate' | 'custom';
export type DensityOption = 'comfortable' | 'compact';
export type RadiusOption = 'none' | 'sm' | 'md' | 'lg';
export type TypographyOption = 'system' | 'inter' | 'serif';
export type MotionOption = 'normal' | 'reduced';

export interface ThemePreferences {
  preset: ThemePreset;
  colors: ThemeColors;
  density: DensityOption;
  radius: RadiusOption;
  typography: TypographyOption;
  motion: MotionOption;
}

export const PRESET_THEMES: Record<Exclude<ThemePreset, 'custom'>, { name: string; description: string; colors: ThemeColors }> = {
  'premium-hospitality': {
    name: 'Premium Hospitality',
    description: 'Warm champagne gold, deep cypress teal, and calm stone neutrals tailored for luxury hospitality.',
    colors: {
      primary: '#765A20',
      secondary: '#F1EBDD',
      accent: '#2F6F6B',
      background: '#F7F8FA',
      surface: '#FFFFFF',
      text: '#18212F',
      mutedText: '#64748B',
      border: '#E2E8F0',
      focus: '#765A20',
    },
  },
  'classic-hotel': {
    name: 'Classic Hotel',
    description: 'Heritage deep royal navy, crisp whites, and amber bronze accents inspired by grand European hotels.',
    colors: {
      primary: '#1E3A8A',
      secondary: '#E2E8F0',
      accent: '#D97706',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      mutedText: '#64748B',
      border: '#CBD5E1',
      focus: '#1E3A8A',
    },
  },
  'modern-slate': {
    name: 'Modern Slate',
    description: 'Contemporary architectural graphite, crisp sage teal accents, and high-clarity contrast surfaces.',
    colors: {
      primary: '#334155',
      secondary: '#E2E8F0',
      accent: '#0D9488',
      background: '#F1F5F9',
      surface: '#FFFFFF',
      text: '#020617',
      mutedText: '#64748B',
      border: '#E2E8F0',
      focus: '#334155',
    },
  },
};

const STORAGE_KEY = 'hms_theme_preferences';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly defaultPreferences: ThemePreferences = {
    preset: 'premium-hospitality',
    colors: { ...PRESET_THEMES['premium-hospitality'].colors },
    density: 'comfortable',
    radius: 'md',
    typography: 'system',
    motion: 'normal',
  };

  readonly preferences = signal<ThemePreferences>(this.loadPreferences());

  readonly currentColors = computed(() => this.preferences().colors);
  readonly currentPreset = computed(() => this.preferences().preset);
  readonly currentDensity = computed(() => this.preferences().density);
  readonly currentRadius = computed(() => this.preferences().radius);
  readonly currentTypography = computed(() => this.preferences().typography);
  readonly currentMotion = computed(() => this.preferences().motion);

  constructor() {
    this.applyThemeToDom(this.preferences());
  }

  private loadPreferences(): ThemePreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          preset: parsed.preset || 'premium-hospitality',
          colors: { ...this.defaultPreferences.colors, ...(parsed.colors || {}) },
          density: parsed.density || 'comfortable',
          radius: parsed.radius || 'md',
          typography: parsed.typography || 'system',
          motion: parsed.motion || 'normal',
        };
      }
    } catch {
      // Fallback on defaults
    }
    return { ...this.defaultPreferences };
  }

  setPreset(preset: Exclude<ThemePreset, 'custom'>): void {
    const presetConfig = PRESET_THEMES[preset];
    if (!presetConfig) return;

    const updated: ThemePreferences = {
      ...this.preferences(),
      preset,
      colors: { ...presetConfig.colors },
    };
    this.updatePreferences(updated);
  }

  setCustomColor(key: keyof ThemeColors, hex: string): void {
    if (!this.isValidHex(hex)) return;

    const updated: ThemePreferences = {
      ...this.preferences(),
      preset: 'custom',
      colors: {
        ...this.preferences().colors,
        [key]: hex.toUpperCase(),
      },
    };
    this.updatePreferences(updated);
  }

  setDensity(density: DensityOption): void {
    const updated: ThemePreferences = {
      ...this.preferences(),
      density,
    };
    this.updatePreferences(updated);
  }

  setRadius(radius: RadiusOption): void {
    const updated: ThemePreferences = {
      ...this.preferences(),
      radius,
    };
    this.updatePreferences(updated);
  }

  setTypography(typography: TypographyOption): void {
    const updated: ThemePreferences = {
      ...this.preferences(),
      typography,
    };
    this.updatePreferences(updated);
  }

  setMotion(motion: MotionOption): void {
    const updated: ThemePreferences = {
      ...this.preferences(),
      motion,
    };
    this.updatePreferences(updated);
  }

  resetToDefault(): void {
    this.updatePreferences({
      preset: 'premium-hospitality',
      colors: { ...PRESET_THEMES['premium-hospitality'].colors },
      density: 'comfortable',
      radius: 'md',
      typography: 'system',
      motion: 'normal',
    });
  }

  private updatePreferences(prefs: ThemePreferences): void {
    this.preferences.set(prefs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage may fail in restricted sandboxes
    }
    this.applyThemeToDom(prefs);
  }

  applyThemeToDom(prefs: ThemePreferences): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const { colors, density, radius, typography, motion } = prefs;

    // Apply color tokens
    root.style.setProperty('--surface-root', colors.background);
    root.style.setProperty('--navy-primary', colors.background);
    root.style.setProperty('--surface-card', colors.surface);
    root.style.setProperty('--navy-secondary', colors.surface);
    root.style.setProperty('--surface-raised', colors.secondary);
    root.style.setProperty('--surface-border', colors.border);
    root.style.setProperty('--surface-border-subtle', colors.border);

    root.style.setProperty('--text-primary', colors.text);
    root.style.setProperty('--text-secondary', colors.text);
    root.style.setProperty('--text-muted', colors.mutedText);

    root.style.setProperty('--gold-accent', colors.primary);
    root.style.setProperty('--gold-dark', this.adjustBrightness(colors.primary, -15));
    root.style.setProperty('--gold-hover', this.adjustBrightness(colors.primary, -15));
    root.style.setProperty('--gold-light', colors.secondary);
    root.style.setProperty('--gold-ring', `${this.hexToRgba(colors.focus, 0.25)}`);
    root.style.setProperty('--accent-color', colors.accent);

    // Apply corner radius
    const radiusMap: Record<RadiusOption, string> = {
      none: '0px',
      sm: '4px',
      md: '8px',
      lg: '14px',
    };
    root.style.setProperty('--radius-default', radiusMap[radius]);
    root.style.setProperty('--radius-sm', radius === 'none' ? '0px' : '4px');
    root.style.setProperty('--radius-md', radiusMap[radius]);
    root.style.setProperty('--radius-lg', radius === 'none' ? '0px' : radius === 'sm' ? '8px' : '14px');

    // Apply typography
    const fontMap: Record<TypographyOption, string> = {
      system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      inter: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      serif: "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
    };
    root.style.setProperty('--font-primary', fontMap[typography]);

    // Apply density classes
    document.body.classList.toggle('density-compact', density === 'compact');
    document.body.classList.toggle('density-comfortable', density === 'comfortable');

    // Apply motion preference
    document.body.classList.toggle('motion-reduced', motion === 'reduced');
  }

  isValidHex(hex: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex.trim());
  }

  calculateContrastRatio(hex1: string, hex2: string): number {
    const lum1 = this.getRelativeLuminance(hex1);
    const lum2 = this.getRelativeLuminance(hex2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private getRelativeLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return 0;
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      return {
        r: parseInt(clean[0] + clean[0], 16),
        g: parseInt(clean[1] + clean[1], 16),
        b: parseInt(clean[2] + clean[2], 16),
      };
    }
    if (clean.length === 6) {
      return {
        r: parseInt(clean.substring(0, 2), 16),
        g: parseInt(clean.substring(2, 4), 16),
        b: parseInt(clean.substring(4, 6), 16),
      };
    }
    return null;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return `rgba(118, 90, 32, ${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  private adjustBrightness(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    const amount = Math.round((percent / 100) * 255);
    const r = Math.min(255, Math.max(0, rgb.r + amount));
    const g = Math.min(255, Math.max(0, rgb.g + amount));
    const b = Math.min(255, Math.max(0, rgb.b + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
  }
}

