import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ThemeService,
  ThemePreset,
  ThemeColors,
  DensityOption,
  RadiusOption,
  TypographyOption,
  MotionOption,
  PRESET_THEMES,
} from '../../core/services/theme.service';
import { ApplicationBrandingService } from '../../core/services/application-branding.service';
import { HmsButtonComponent, HmsAlertComponent, HmsStatusPillComponent } from '../../shared/index';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsButtonComponent, HmsAlertComponent, HmsStatusPillComponent],
  templateUrl: './appearance-settings.component.html',
  styleUrls: ['./appearance-settings.component.css'],
})
export class AppearanceSettingsComponent {
  readonly themeService = inject(ThemeService);
  readonly branding = inject(ApplicationBrandingService);

  readonly presets = PRESET_THEMES;
  readonly presetKeys: Array<Exclude<ThemePreset, 'custom'>> = ['premium-hospitality', 'classic-hotel', 'modern-slate'];

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

  // Custom edit model
  customHexes: Record<keyof ThemeColors, string> = { ...this.colors() };

  // Contrast calculations
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

  selectPreset(preset: Exclude<ThemePreset, 'custom'>): void {
    this.themeService.setPreset(preset);
    this.customHexes = { ...this.themeService.currentColors() };
    this.showSuccess(`Applied "${this.presets[preset].name}" theme.`);
  }

  onCustomColorChange(key: keyof ThemeColors, hex: string): void {
    if (this.themeService.isValidHex(hex)) {
      this.themeService.setCustomColor(key, hex);
    }
  }

  onDensityChange(density: DensityOption): void {
    this.themeService.setDensity(density);
    this.showSuccess(`Layout density set to ${density}.`);
  }

  onRadiusChange(radius: RadiusOption): void {
    this.themeService.setRadius(radius);
    this.showSuccess(`Corner radius set to ${radius}.`);
  }

  onTypographyChange(typography: TypographyOption): void {
    this.themeService.setTypography(typography);
    this.showSuccess(`Typography set to ${typography}.`);
  }

  onMotionChange(motion: MotionOption): void {
    this.themeService.setMotion(motion);
    this.showSuccess(`Motion animations set to ${motion}.`);
  }

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

  resetDefaults(): void {
    this.themeService.resetToDefault();
    this.customHexes = { ...this.themeService.currentColors() };
    this.resetBrandingDefaults();
    this.showSuccess('Settings reset to system defaults.');
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

