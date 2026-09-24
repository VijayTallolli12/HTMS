import { Injectable, signal, computed, inject } from '@angular/core';

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

export type ThemeCategory = 'professional' | 'seasonal' | 'festival' | 'custom';

export type ThemePreset =
  | 'premium-hospitality'
  | 'classic-hotel'
  | 'modern-slate'
  | 'luxury-champagne'
  | 'deep-navy-hotel'
  | 'sage-resort'
  | 'coastal-resort'
  | 'executive-graphite'
  | 'royal-hotel'
  | 'holiday-season'
  | 'new-year'
  | 'spring-resort'
  | 'summer-resort'
  | 'autumn-hotel'
  | 'ramadan-night'
  | 'lunar-new-year'
  | 'custom';

export type DensityOption = 'compact' | 'comfortable' | 'spacious';
export type RadiusOption = 'none' | 'sm' | 'md' | 'lg';

export type LineHeightOption = 'compact' | 'comfortable' | 'relaxed';
export type LetterSpacingOption = 'tight' | 'default' | 'wide';
export type HeadingScaleOption = 'classic' | 'prominent' | 'editorial';

export type MotionPreferenceOption = 'full' | 'reduced' | 'minimal' | 'none';
export type MotionIntensityOption = 'subtle' | 'balanced' | 'expressive';
export type TransitionSpeedOption = 'fast' | 'normal' | 'slow';
export type MotionStyleOption = 'subtle' | 'professional' | 'smooth' | 'expressive';

export interface TypographyPreferences {
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  bodyWeight: number;
  baseFontSize: number;
  lineHeight: LineHeightOption;
  letterSpacing: LetterSpacingOption;
  headingScale: HeadingScaleOption;
}

export interface MotionPreferences {
  preference: MotionPreferenceOption;
  intensity: MotionIntensityOption;
  speed: TransitionSpeedOption;
  style: MotionStyleOption;
}

export interface ThemePreferences {
  preset: ThemePreset;
  colors: ThemeColors;
  density: DensityOption;
  radius: RadiusOption;
  typography: TypographyPreferences;
  motion: MotionPreferences;
}

export interface FontMetadata {
  id: string;
  name: string;
  category: 'system' | 'modern-sans' | 'friendly' | 'editorial';
  weights: number[];
  googleFontFamily?: string;
  fallback: string;
}

export const BUILT_IN_FONTS: FontMetadata[] = [
  {
    id: 'system',
    name: 'System Sans',
    category: 'system',
    weights: [400, 500, 600, 700],
    fallback: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: 'inter',
    name: 'Inter',
    category: 'modern-sans',
    weights: [400, 500, 600, 700, 800],
    googleFontFamily: 'Inter',
    fallback: "-apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    id: 'roboto',
    name: 'Roboto',
    category: 'modern-sans',
    weights: [400, 500, 700],
    googleFontFamily: 'Roboto',
    fallback: "sans-serif",
  },
  {
    id: 'manrope',
    name: 'Manrope',
    category: 'modern-sans',
    weights: [400, 500, 600, 700, 800],
    googleFontFamily: 'Manrope',
    fallback: "sans-serif",
  },
  {
    id: 'work-sans',
    name: 'Work Sans',
    category: 'modern-sans',
    weights: [400, 500, 600, 700],
    googleFontFamily: 'Work+Sans',
    fallback: "sans-serif",
  },
  {
    id: 'source-sans-3',
    name: 'Source Sans 3',
    category: 'modern-sans',
    weights: [400, 500, 600, 700],
    googleFontFamily: 'Source+Sans+3',
    fallback: "sans-serif",
  },
  {
    id: 'poppins',
    name: 'Poppins',
    category: 'friendly',
    weights: [400, 500, 600, 700],
    googleFontFamily: 'Poppins',
    fallback: "sans-serif",
  },
  {
    id: 'nunito',
    name: 'Nunito',
    category: 'friendly',
    weights: [400, 500, 600, 700],
    googleFontFamily: 'Nunito',
    fallback: "sans-serif",
  },
  {
    id: 'lato',
    name: 'Lato',
    category: 'friendly',
    weights: [400, 700],
    googleFontFamily: 'Lato',
    fallback: "sans-serif",
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    category: 'modern-sans',
    weights: [400, 500, 600, 700, 800],
    googleFontFamily: 'Montserrat',
    fallback: "sans-serif",
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    category: 'friendly',
    weights: [400, 500, 600, 700],
    googleFontFamily: 'Open+Sans',
    fallback: "sans-serif",
  },
  {
    id: 'noto-sans',
    name: 'Noto Sans',
    category: 'modern-sans',
    weights: [400, 500, 600, 700],
    googleFontFamily: 'Noto+Sans',
    fallback: "sans-serif",
  },
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    category: 'editorial',
    weights: [400, 500, 600, 700],
    googleFontFamily: 'Playfair+Display',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    category: 'editorial',
    weights: [400, 700],
    googleFontFamily: 'Merriweather',
    fallback: "Georgia, serif",
  },
  {
    id: 'noto-serif',
    name: 'Noto Serif',
    category: 'editorial',
    weights: [400, 700],
    googleFontFamily: 'Noto+Serif',
    fallback: "Georgia, serif",
  },
];

export interface PresetThemeDefinition {
  name: string;
  category: ThemeCategory;
  description: string;
  colors: ThemeColors;
}

export const PRESET_THEMES: Record<Exclude<ThemePreset, 'custom'>, PresetThemeDefinition> = {
  // --- Professional Themes ---
  'premium-hospitality': {
    name: 'Premium Hospitality',
    category: 'professional',
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
    category: 'professional',
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
    category: 'professional',
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
  'luxury-champagne': {
    name: 'Luxury Champagne',
    category: 'professional',
    description: 'Refined warm brass, soft alabaster ivory, and subtle olive accents for high-end boutique resorts.',
    colors: {
      primary: '#8A6A32',
      secondary: '#EDE5D5',
      accent: '#6B7A6A',
      background: '#F8F6F1',
      surface: '#FFFFFF',
      text: '#241F1A',
      mutedText: '#64748B',
      border: '#E2DACB',
      focus: '#8A6A32',
    },
  },
  'deep-navy-hotel': {
    name: 'Deep Navy Hotel',
    category: 'professional',
    description: 'Executive midnight indigo with warm burnished bronze highlights for distinguished city hotels.',
    colors: {
      primary: '#1E3A5F',
      secondary: '#E3EAF2',
      accent: '#B78A3C',
      background: '#F5F7FA',
      surface: '#FFFFFF',
      text: '#172033',
      mutedText: '#64748B',
      border: '#CBD5E1',
      focus: '#1E3A5F',
    },
  },
  'sage-resort': {
    name: 'Sage Resort',
    category: 'professional',
    description: 'Tranquil eucalyptus sage, organic mist neutrals, and warm ochre accents for wellness destinations.',
    colors: {
      primary: '#56745F',
      secondary: '#E1EADF',
      accent: '#B58B54',
      background: '#F4F7F3',
      surface: '#FFFFFF',
      text: '#26352F',
      mutedText: '#64748B',
      border: '#CCD8C9',
      focus: '#56745F',
    },
  },
  'coastal-resort': {
    name: 'Coastal Resort',
    category: 'professional',
    description: 'Pacific ocean teal, breezy seafoam whites, and sun-warmed sand accents for seaside hospitality.',
    colors: {
      primary: '#247A86',
      secondary: '#DCECEF',
      accent: '#C49A57',
      background: '#F4F8F9',
      surface: '#FFFFFF',
      text: '#18323A',
      mutedText: '#64748B',
      border: '#CBE1E6',
      focus: '#247A86',
    },
  },
  'executive-graphite': {
    name: 'Executive Graphite',
    category: 'professional',
    description: 'Disciplined slate charcoal, minimalist cool steel, and brushed copper touches for corporate groups.',
    colors: {
      primary: '#3B4652',
      secondary: '#E3E6E9',
      accent: '#9A7B4F',
      background: '#F5F6F7',
      surface: '#FFFFFF',
      text: '#20252B',
      mutedText: '#64748B',
      border: '#D1D7DC',
      focus: '#3B4652',
    },
  },
  'royal-hotel': {
    name: 'Royal Hotel',
    category: 'professional',
    description: 'Regal amethyst plum, gentle lavender undertones, and warm antique gold for palace properties.',
    colors: {
      primary: '#4B3D73',
      secondary: '#E8E3F1',
      accent: '#B18B4A',
      background: '#F7F6FA',
      surface: '#FFFFFF',
      text: '#202033',
      mutedText: '#64748B',
      border: '#D5CCE5',
      focus: '#4B3D73',
    },
  },

  // --- Seasonal & Festival Themes ---
  'holiday-season': {
    name: 'Holiday Season',
    category: 'seasonal',
    description: 'Restrained winter spruce evergreen, warm champagne gold, and crisp snow neutrals for the winter holidays.',
    colors: {
      primary: '#315C48',
      secondary: '#E6EEE9',
      accent: '#B08A4A',
      background: '#F8FAF8',
      surface: '#FFFFFF',
      text: '#1F2933',
      mutedText: '#64748B',
      border: '#D1DDD5',
      focus: '#315C48',
    },
  },
  'new-year': {
    name: 'New Year Gala',
    category: 'seasonal',
    description: 'Celebratory midnight navy, brilliant champagne sparkle, and warm white radiance for New Year festivities.',
    colors: {
      primary: '#23395D',
      secondary: '#E8E4D8',
      accent: '#C7A85A',
      background: '#F8F8F6',
      surface: '#FFFFFF',
      text: '#172033',
      mutedText: '#64748B',
      border: '#D8D2C2',
      focus: '#23395D',
    },
  },
  'spring-resort': {
    name: 'Spring Blossom',
    category: 'seasonal',
    description: 'Fresh meadow green, gentle ivory light, and subtle floral rose undertones for spring awakenings.',
    colors: {
      primary: '#436A55',
      secondary: '#E7EFEA',
      accent: '#C07D6D',
      background: '#F8FAF7',
      surface: '#FFFFFF',
      text: '#252D28',
      mutedText: '#64748B',
      border: '#D1DFD7',
      focus: '#436A55',
    },
  },
  'summer-resort': {
    name: 'Summer Riviera',
    category: 'seasonal',
    description: 'Luminous cobalt blue, sun-bleached coastal neutrals, and golden dune accents for peak summer stays.',
    colors: {
      primary: '#1C5F7A',
      secondary: '#E0EBF0',
      accent: '#C59B51',
      background: '#F6F9FA',
      surface: '#FFFFFF',
      text: '#1A2833',
      mutedText: '#64748B',
      border: '#CADAE3',
      focus: '#1C5F7A',
    },
  },
  'autumn-hotel': {
    name: 'Autumn Harvest',
    category: 'seasonal',
    description: 'Rich terracotta warmth, toasted walnut neutrals, and muted moss accents for crisp autumn comfort.',
    colors: {
      primary: '#8C4E2D',
      secondary: '#EFE4DC',
      accent: '#697858',
      background: '#FAF7F5',
      surface: '#FFFFFF',
      text: '#2D231E',
      mutedText: '#64748B',
      border: '#DFD3CB',
      focus: '#8C4E2D',
    },
  },
  'ramadan-night': {
    name: 'Ramadan Night',
    category: 'festival',
    description: 'Sophisticated nocturnal teal, tranquil moonlit silver, and subtle Islamic lantern gold for holy month elegance.',
    colors: {
      primary: '#1C443C',
      secondary: '#DFE8E4',
      accent: '#C5A059',
      background: '#F6F8F9',
      surface: '#FFFFFF',
      text: '#141E28',
      mutedText: '#64748B',
      border: '#CAD7D0',
      focus: '#1C443C',
    },
  },
  'lunar-new-year': {
    name: 'Lunar New Year',
    category: 'festival',
    description: 'Auspicious crimson ruby, warm cream silk, and gilded imperial gold with strict operational contrast.',
    colors: {
      primary: '#8E2B2B',
      secondary: '#F0E3E1',
      accent: '#BFA054',
      background: '#FAF7F5',
      surface: '#FFFFFF',
      text: '#2B1D1D',
      mutedText: '#64748B',
      border: '#E3CECC',
      focus: '#8E2B2B',
    },
  },
};

const STORAGE_KEY = 'hms_theme_preferences';
const FAVORITES_KEY = 'hms_theme_favorites';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly defaultPreferences: ThemePreferences = {
    preset: 'premium-hospitality',
    colors: { ...PRESET_THEMES['premium-hospitality'].colors },
    density: 'comfortable',
    radius: 'md',
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingWeight: 600,
      bodyWeight: 400,
      baseFontSize: 16,
      lineHeight: 'comfortable',
      letterSpacing: 'default',
      headingScale: 'prominent',
    },
    motion: {
      preference: 'full',
      intensity: 'balanced',
      speed: 'normal',
      style: 'professional',
    },
  };

  readonly preferences = signal<ThemePreferences>(this.loadPreferences());
  readonly favorites = signal<string[]>(this.loadFavorites());

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
        const typo = parsed.typography;
        const mot = parsed.motion;

        return {
          preset: parsed.preset || 'premium-hospitality',
          colors: { ...this.defaultPreferences.colors, ...(parsed.colors || {}) },
          density: parsed.density || 'comfortable',
          radius: parsed.radius || 'md',
          typography: {
            headingFont: typeof typo === 'string' ? 'Inter' : typo?.headingFont || 'Inter',
            bodyFont: typeof typo === 'string' ? typo || 'Inter' : typo?.bodyFont || 'Inter',
            headingWeight: typo?.headingWeight || 600,
            bodyWeight: typo?.bodyWeight || 400,
            baseFontSize: typo?.baseFontSize || 16,
            lineHeight: typo?.lineHeight || 'comfortable',
            letterSpacing: typo?.letterSpacing || 'default',
            headingScale: typo?.headingScale || 'prominent',
          },
          motion: {
            preference: typeof mot === 'string' ? (mot === 'reduced' ? 'reduced' : 'full') : mot?.preference || 'full',
            intensity: mot?.intensity || 'balanced',
            speed: mot?.speed || 'normal',
            style: mot?.style || 'professional',
          },
        };
      }
    } catch {
      // Fallback on defaults
    }
    return { ...this.defaultPreferences };
  }

  private loadFavorites(): string[] {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return ['premium-hospitality', 'classic-hotel'];
  }

  toggleFavorite(presetKey: string): void {
    const current = this.favorites();
    const updated = current.includes(presetKey)
      ? current.filter((k) => k !== presetKey)
      : [...current, presetKey];
    this.favorites.set(updated);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch {}
  }

  isFavorite(presetKey: string): boolean {
    return this.favorites().includes(presetKey);
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

  setTypography(partial: Partial<TypographyPreferences>): void {
    const current = this.preferences().typography;
    const updatedTypography: TypographyPreferences = {
      ...current,
      ...partial,
    };

    const updated: ThemePreferences = {
      ...this.preferences(),
      typography: updatedTypography,
    };
    this.updatePreferences(updated);

    // Lazy load Google fonts if selected
    if (partial.headingFont) this.loadFontIfGoogle(partial.headingFont);
    if (partial.bodyFont) this.loadFontIfGoogle(partial.bodyFont);
  }

  setMotion(partial: Partial<MotionPreferences>): void {
    const current = this.preferences().motion;
    const updatedMotion: MotionPreferences = {
      ...current,
      ...partial,
    };

    const updated: ThemePreferences = {
      ...this.preferences(),
      motion: updatedMotion,
    };
    this.updatePreferences(updated);
  }

  resetTheme(): void {
    this.setPreset('premium-hospitality');
  }

  resetToDefault(): void {
    this.updatePreferences({
      preset: 'premium-hospitality',
      colors: { ...PRESET_THEMES['premium-hospitality'].colors },
      density: 'comfortable',
      radius: 'md',
      typography: { ...this.defaultPreferences.typography },
      motion: { ...this.defaultPreferences.motion },
    });
  }

  exportPreferencesJson(): string {
    return JSON.stringify(this.preferences(), null, 2);
  }

  importPreferencesJson(jsonStr: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'Invalid JSON format.' };
      }

      const imported: ThemePreferences = {
        preset: parsed.preset || 'custom',
        colors: { ...this.defaultPreferences.colors, ...(parsed.colors || {}) },
        density: parsed.density || 'comfortable',
        radius: parsed.radius || 'md',
        typography: {
          ...this.defaultPreferences.typography,
          ...(parsed.typography || {}),
        },
        motion: {
          ...this.defaultPreferences.motion,
          ...(parsed.motion || {}),
        },
      };

      this.updatePreferences(imported);
      if (imported.typography.headingFont) this.loadFontIfGoogle(imported.typography.headingFont);
      if (imported.typography.bodyFont) this.loadFontIfGoogle(imported.typography.bodyFont);

      return { success: true, message: 'Theme preferences imported successfully.' };
    } catch (err: any) {
      return { success: false, message: `Import failed: ${err.message}` };
    }
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

    // Apply typography stacks
    const bodyFontStack = this.resolveFontFamily(typography.bodyFont);
    const headingFontStack = this.resolveFontFamily(typography.headingFont);

    root.style.setProperty('--font-primary', bodyFontStack);
    root.style.setProperty('--font-heading', headingFontStack);
    root.style.setProperty('--font-body-weight', `${typography.bodyWeight}`);
    root.style.setProperty('--font-heading-weight', `${typography.headingWeight}`);
    root.style.setProperty('--font-size-base', `${typography.baseFontSize}px`);

    const lineHeightMap: Record<LineHeightOption, string> = {
      compact: '1.35',
      comfortable: '1.5',
      relaxed: '1.65',
    };
    root.style.setProperty('--line-height-base', lineHeightMap[typography.lineHeight] || '1.5');

    const letterSpacingMap: Record<LetterSpacingOption, string> = {
      tight: '-0.02em',
      default: '0',
      wide: '0.03em',
    };
    root.style.setProperty('--letter-spacing-base', letterSpacingMap[typography.letterSpacing] || '0');

    // Apply motion timing
    const speedMap: Record<TransitionSpeedOption, string> = {
      fast: '120ms',
      normal: '200ms',
      slow: '300ms',
    };
    const speed = motion.preference === 'none' ? '0ms' : speedMap[motion.speed] || '200ms';
    root.style.setProperty('--transition-speed', speed);

    const timingMap: Record<MotionStyleOption, string> = {
      subtle: 'cubic-bezier(0.4, 0, 0.2, 1)',
      professional: 'ease-out',
      smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      expressive: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
    root.style.setProperty('--transition-timing', timingMap[motion.style] || 'ease-out');

    // Apply body classes
    document.body.classList.toggle('density-compact', density === 'compact');
    document.body.classList.toggle('density-comfortable', density === 'comfortable');
    document.body.classList.toggle('density-spacious', density === 'spacious');

    document.body.classList.toggle('motion-none', motion.preference === 'none');
    document.body.classList.toggle('motion-reduced', motion.preference === 'reduced');
    document.body.classList.toggle('motion-minimal', motion.preference === 'minimal');
    document.body.classList.toggle('motion-full', motion.preference === 'full');
  }

  resolveFontFamily(fontName: string): string {
    const meta = BUILT_IN_FONTS.find(
      (f) => f.name.toLowerCase() === fontName.toLowerCase() || f.id === fontName.toLowerCase(),
    );
    if (meta) {
      return meta.fallback.includes(meta.name)
        ? meta.fallback
        : `'${meta.name}', ${meta.fallback}`;
    }
    // Custom font or fallback
    return `'${fontName}', -apple-system, BlinkMacSystemFont, sans-serif`;
  }

  loadFontIfGoogle(fontName: string): void {
    if (typeof document === 'undefined') return;
    const meta = BUILT_IN_FONTS.find(
      (f) => f.name.toLowerCase() === fontName.toLowerCase() || f.id === fontName.toLowerCase(),
    );
    if (!meta || !meta.googleFontFamily) return;

    const linkId = `google-font-${meta.id}`;
    if (document.getElementById(linkId)) return;

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    const weightsStr = meta.weights.join(';');
    link.href = `https://fonts.googleapis.com/css2?family=${meta.googleFontFamily}:wght@${weightsStr}&display=swap`;
    document.head.appendChild(link);
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
