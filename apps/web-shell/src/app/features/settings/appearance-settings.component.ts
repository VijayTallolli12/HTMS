import { Component, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ThemeService,
  ThemePreset,
  ThemeColors,
  DensityOption,
  RadiusOption,
  LineHeightOption,
  LetterSpacingOption,
  HeadingScaleOption,
  MotionPreferenceOption,
  MotionIntensityOption,
  TransitionSpeedOption,
  MotionStyleOption,
  PRESET_THEMES,
  BUILT_IN_FONTS,
  FontMetadata,
} from '../../core/services/theme.service';
import { CustomFontService, CustomFontRecord } from '../../core/services/custom-font.service';
import { ApplicationBrandingService } from '../../core/services/application-branding.service';
import { HmsButtonComponent, HmsAlertComponent, HmsStatusPillComponent } from '../../shared/index';

export type StudioTab = 'themes' | 'colors' | 'typography' | 'motion' | 'layout' | 'branding';

export interface RecommendedPairing {
  name: string;
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  bodyWeight: number;
  tag: string;
}

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsButtonComponent, HmsAlertComponent, HmsStatusPillComponent],
  templateUrl: './appearance-settings.component.html',
  styleUrls: ['./appearance-settings.component.css'],
})
export class AppearanceSettingsComponent {
  readonly themeService = inject(ThemeService);
  readonly customFontService = inject(CustomFontService);
  readonly branding = inject(ApplicationBrandingService);

  @ViewChild('importFileInput') importFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('customFontFileInput') customFontFileInput!: ElementRef<HTMLInputElement>;

  // Tab navigation
  readonly activeTab = signal<StudioTab>('themes');

  // Search & Filter for Themes
  readonly themeSearch = signal<string>('');
  readonly themeCategory = signal<'all' | 'professional' | 'seasonal' | 'festival' | 'favorites'>('all');

  // Data references from services
  readonly presets = PRESET_THEMES;
  readonly allPresetKeys = Object.keys(PRESET_THEMES) as Array<Exclude<ThemePreset, 'custom'>>;
  readonly builtInFonts = BUILT_IN_FONTS;
  readonly customFonts = this.customFontService.customFonts;

  readonly activePreset = this.themeService.currentPreset;
  readonly colors = this.themeService.currentColors;
  readonly density = this.themeService.currentDensity;
  readonly radius = this.themeService.currentRadius;
  readonly typography = this.themeService.currentTypography;
  readonly motion = this.themeService.currentMotion;

  // Branding edit model
  brandingEdit = {
    applicationName: this.branding.applicationName(),
    applicationSubtitle: this.branding.applicationSubtitle(),
  };

  // Custom colors edit model
  customHexes: Record<keyof ThemeColors, string> = { ...this.colors() };

  // Recommended typography pairings
  readonly recommendedPairings: RecommendedPairing[] = [
    {
      name: 'Luxury Editorial',
      headingFont: 'Playfair Display',
      bodyFont: 'Inter',
      headingWeight: 700,
      bodyWeight: 400,
      tag: 'Boutique & Heritage',
    },
    {
      name: 'Executive Hospitality',
      headingFont: 'Cinzel',
      bodyFont: 'Plus Jakarta Sans',
      headingWeight: 600,
      bodyWeight: 400,
      tag: '5-Star Luxury',
    },
    {
      name: 'Modern Clean',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingWeight: 600,
      bodyWeight: 400,
      tag: 'Contemporary Standard',
    },
    {
      name: 'Warm Boutique',
      headingFont: 'Outfit',
      bodyFont: 'DM Sans',
      headingWeight: 600,
      bodyWeight: 400,
      tag: 'Resort & Spa',
    },
    {
      name: 'Classical Heritage',
      headingFont: 'Cormorant Garamond',
      bodyFont: 'Merriweather',
      headingWeight: 700,
      bodyWeight: 400,
      tag: 'Historic Properties',
    },
  ];

  // Custom Font Upload state
  fontUploadName = signal<string>('');
  fontUploadWeight = signal<number>(400);
  fontUploadStyle = signal<'normal' | 'italic'>('normal');
  fontUploadFile = signal<File | null>(null);
  fontUploadError = signal<string | null>(null);
  fontUploadSuccess = signal<string | null>(null);
  isUploadingFont = signal<boolean>(false);

  // Motion test trigger state
  motionTesting = signal<boolean>(false);

  // Contrast calculations for active colors
  readonly textBackgroundContrast = computed(() => {
    return this.themeService.calculateContrastRatio(this.colors().text, this.colors().background);
  });

  readonly primarySurfaceContrast = computed(() => {
    return this.themeService.calculateContrastRatio(this.colors().primary, this.colors().surface);
  });

  readonly isLowContrast = computed(() => {
    return this.textBackgroundContrast() < 4.5 || this.primarySurfaceContrast() < 3.0;
  });

  readonly successMessage = signal<string | null>(null);

  // Filtered preset themes list
  readonly filteredPresets = computed(() => {
    const search = this.themeSearch().toLowerCase().trim();
    const category = this.themeCategory();
    const favs = this.themeService.favorites();

    return this.allPresetKeys.filter((key) => {
      const preset = this.presets[key];
      if (!preset) return false;

      // Category check
      if (category === 'favorites') {
        if (!favs.includes(key)) return false;
      } else if (category !== 'all' && preset.category !== category) {
        return false;
      }

      // Search check
      if (search) {
        const matchName = preset.name.toLowerCase().includes(search);
        const matchDesc = preset.description.toLowerCase().includes(search);
        if (!matchName && !matchDesc) return false;
      }

      return true;
    });
  });

  // All available fonts (built-in + uploaded custom)
  readonly allAvailableFonts = computed(() => {
    const list: Array<{ id: string; name: string; category: string; isCustom: boolean }> = [];

    for (const font of this.builtInFonts) {
      list.push({
        id: font.name,
        name: font.name,
        category: font.category,
        isCustom: false,
      });
    }

    for (const cf of this.customFonts()) {
      if (!list.some((f) => f.name.toLowerCase() === cf.name.toLowerCase())) {
        list.push({
          id: cf.name,
          name: cf.name,
          category: 'custom',
          isCustom: true,
        });
      }
    }

    return list;
  });

  // Navigation
  setActiveTab(tab: StudioTab): void {
    this.activeTab.set(tab);
  }

  // Preset operations
  selectPreset(preset: Exclude<ThemePreset, 'custom'>): void {
    this.themeService.setPreset(preset);
    this.customHexes = { ...this.themeService.currentColors() };
    this.showSuccess(`Applied "${this.presets[preset].name}" theme.`);
  }

  toggleFavorite(presetKey: string, event: Event): void {
    event.stopPropagation();
    this.themeService.toggleFavorite(presetKey);
  }

  isFavorite(presetKey: string): boolean {
    return this.themeService.isFavorite(presetKey);
  }

  getPresetContrast(key: Exclude<ThemePreset, 'custom'>): { ratio: number; pass: boolean } {
    const p = this.presets[key];
    const ratio = this.themeService.calculateContrastRatio(p.colors.text, p.colors.background);
    return { ratio, pass: ratio >= 4.5 };
  }

  // Color tokens
  onCustomColorChange(key: keyof ThemeColors, hex: string): void {
    if (this.themeService.isValidHex(hex)) {
      this.themeService.setCustomColor(key, hex);
    }
  }

  // Typography controls
  onHeadingFontChange(font: string): void {
    this.themeService.setTypography({ headingFont: font });
    this.showSuccess(`Heading font updated to ${font}.`);
  }

  onBodyFontChange(font: string): void {
    this.themeService.setTypography({ bodyFont: font });
    this.showSuccess(`Body font updated to ${font}.`);
  }

  onHeadingWeightChange(weight: number): void {
    this.themeService.setTypography({ headingWeight: weight });
  }

  onBodyWeightChange(weight: number): void {
    this.themeService.setTypography({ bodyWeight: weight });
  }

  onBaseFontSizeChange(size: number): void {
    this.themeService.setTypography({ baseFontSize: size });
  }

  onLineHeightChange(lh: LineHeightOption): void {
    this.themeService.setTypography({ lineHeight: lh });
  }

  onLetterSpacingChange(ls: LetterSpacingOption): void {
    this.themeService.setTypography({ letterSpacing: ls });
  }

  onHeadingScaleChange(scale: HeadingScaleOption): void {
    this.themeService.setTypography({ headingScale: scale });
  }

  applyPairing(pairing: RecommendedPairing): void {
    this.themeService.setTypography({
      headingFont: pairing.headingFont,
      bodyFont: pairing.bodyFont,
      headingWeight: pairing.headingWeight,
      bodyWeight: pairing.bodyWeight,
    });
    this.showSuccess(`Applied "${pairing.name}" font pairing.`);
  }

  // Custom Font Upload
  onFontFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.fontUploadFile.set(file);
      this.fontUploadError.set(null);

      // Auto-suggest font name from file name
      if (!this.fontUploadName()) {
        const guessedName = file.name
          .replace(/\.(woff2|woff|ttf)$/i, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        this.fontUploadName.set(guessedName);
      }
    }
  }

  async uploadCustomFont(): Promise<void> {
    const file = this.fontUploadFile();
    const name = this.fontUploadName().trim();
    const weight = this.fontUploadWeight();
    const style = this.fontUploadStyle();

    if (!file) {
      this.fontUploadError.set('Please select a font file (.woff2, .woff, .ttf).');
      return;
    }
    if (!name) {
      this.fontUploadError.set('Please enter a font name.');
      return;
    }

    this.isUploadingFont.set(true);
    this.fontUploadError.set(null);
    this.fontUploadSuccess.set(null);

    try {
      await this.customFontService.saveFont(file, name, weight, style);
      this.fontUploadSuccess.set(`Font "${name}" (${weight}) registered successfully.`);
      this.fontUploadFile.set(null);
      this.fontUploadName.set('');
      if (this.customFontFileInput) {
        this.customFontFileInput.nativeElement.value = '';
      }
      this.showSuccess(`Custom font "${name}" installed.`);
    } catch (err: any) {
      this.fontUploadError.set(err.message || 'Failed to upload font.');
    } finally {
      this.isUploadingFont.set(false);
    }
  }

  async removeCustomFont(id: string, name: string): Promise<void> {
    try {
      await this.customFontService.removeFont(id);
      this.showSuccess(`Removed font "${name}".`);
    } catch (err: any) {
      this.fontUploadError.set(err.message || 'Could not remove font.');
    }
  }

  // Motion controls
  onMotionPreferenceChange(pref: MotionPreferenceOption): void {
    this.themeService.setMotion({ preference: pref });
    this.showSuccess(`Motion preference set to ${pref}.`);
  }

  onMotionIntensityChange(intensity: MotionIntensityOption): void {
    this.themeService.setMotion({ intensity });
  }

  onMotionSpeedChange(speed: TransitionSpeedOption): void {
    this.themeService.setMotion({ speed });
  }

  onMotionStyleChange(style: MotionStyleOption): void {
    this.themeService.setMotion({ style });
  }

  testMotion(): void {
    this.motionTesting.set(true);
    setTimeout(() => {
      this.motionTesting.set(false);
    }, 600);
  }

  // Layout controls
  onDensityChange(density: DensityOption): void {
    this.themeService.setDensity(density);
    this.showSuccess(`Layout density set to ${density}.`);
  }

  onRadiusChange(radius: RadiusOption): void {
    this.themeService.setRadius(radius);
    this.showSuccess(`Corner radius set to ${radius}.`);
  }

  // Application Branding
  onBrandingChange(): void {
    this.branding.updateBranding({
      applicationName: this.brandingEdit.applicationName,
      applicationSubtitle: this.brandingEdit.applicationSubtitle,
    });
  }

  resetBrandingDefaults(): void {
    this.branding.resetToDefault();
    this.brandingEdit = {
      applicationName: this.branding.applicationName(),
      applicationSubtitle: this.branding.applicationSubtitle(),
    };
    this.showSuccess('Application branding restored to defaults.');
  }

  // Export / Import
  exportSettings(): void {
    const jsonStr = this.themeService.exportPreferencesJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hms-appearance.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showSuccess('Appearance configuration exported as hms-appearance.json');
  }

  triggerImportClick(): void {
    if (this.importFileInput) {
      this.importFileInput.nativeElement.click();
    }
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const res = this.themeService.importPreferencesJson(text);
      if (res.success) {
        this.customHexes = { ...this.themeService.currentColors() };
        this.showSuccess('Appearance settings imported successfully.');
      } else {
        this.fontUploadError.set(res.message);
      }
      input.value = '';
    };

    reader.readAsText(file);
  }

  // Reset controls
  resetThemeOnly(): void {
    this.themeService.resetTheme();
    this.customHexes = { ...this.themeService.currentColors() };
    this.showSuccess('Theme colors reset to Premium Hospitality.');
  }

  resetDefaults(): void {
    this.themeService.resetToDefault();
    this.customHexes = { ...this.themeService.currentColors() };
    this.resetBrandingDefaults();
    this.showSuccess('All appearance studio settings restored to system defaults.');
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      if (this.successMessage() === msg) {
        this.successMessage.set(null);
      }
    }, 4000);
  }
}
