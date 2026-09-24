import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService, ThemePreset, PRESET_THEMES } from '../../../core/services/theme.service';
import { HmsAlertComponent } from '../../../shared/index';

@Component({
  selector: 'app-appearance-themes',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsAlertComponent],
  template: `
    <div class="themes-page-container">
      <!-- Page Header -->
      <header class="section-header">
        <div class="header-titles">
          <div class="eyebrow-badge">THEMES</div>
          <h1 class="section-title">Theme Presets</h1>
          <p class="section-desc">Choose the visual personality of your HMS workspace.</p>
        </div>

        <div class="header-actions">
          <button type="button" class="action-btn" (click)="resetTheme()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-svg" aria-hidden="true">
              <polyline points="1 4 1 10 7 10"></polyline>
              <polyline points="23 20 23 14 17 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            <span>Reset Theme</span>
          </button>
        </div>
      </header>

      <!-- Success Notification -->
      <hms-alert type="success" *ngIf="successMessage()" (closed)="successMessage.set(null)">
        {{ successMessage() }}
      </hms-alert>

      <!-- Category Filter Pills & Search Bar (Wrapping, NO horizontal scroll) -->
      <div class="theme-toolbar">
        <div class="category-filters" role="group" aria-label="Theme categories">
          <button
            type="button"
            class="filter-pill"
            [class.is-active]="themeCategory() === 'all'"
            (click)="themeCategory.set('all')"
          >
            All ({{ allPresetKeys.length }})
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.is-active]="themeCategory() === 'professional'"
            (click)="themeCategory.set('professional')"
          >
            Professional (9)
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.is-active]="themeCategory() === 'seasonal'"
            (click)="themeCategory.set('seasonal')"
          >
            Seasonal (5)
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.is-active]="themeCategory() === 'festival'"
            (click)="themeCategory.set('festival')"
          >
            Festival (2)
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.is-active]="themeCategory() === 'favorites'"
            (click)="themeCategory.set('favorites')"
          >
            ★ Favorites ({{ themeService.favorites().length }})
          </button>
        </div>

        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="theme-search-input"
            placeholder="Search presets by name or style..."
            [ngModel]="themeSearch()"
            (ngModelChange)="themeSearch.set($event)"
          />
        </div>
      </div>

      <!-- Theme Cards Grid -->
      <div class="presets-grid">
        <div
          *ngFor="let key of filteredPresets()"
          class="preset-item"
          [class.is-active]="activePreset() === key"
          (click)="selectPreset(key)"
        >
          <!-- Preset Card Header -->
          <div class="preset-card-top">
            <span class="category-badge" [attr.data-cat]="presets[key].category">
              {{ presets[key].category | uppercase }}
            </span>
            <button
              type="button"
              class="favorite-star-btn"
              [class.is-fav]="isFavorite(key)"
              (click)="toggleFavorite(key, $event)"
              title="Toggle favorite"
              aria-label="Toggle favorite"
            >
              ★
            </button>
          </div>

          <!-- Color Swatches Bar -->
          <div class="preset-swatches">
            <span class="swatch" [style.background]="presets[key].colors.primary" title="Primary"></span>
            <span class="swatch" [style.background]="presets[key].colors.secondary" title="Secondary"></span>
            <span class="swatch" [style.background]="presets[key].colors.accent" title="Accent"></span>
            <span class="swatch" [style.background]="presets[key].colors.background" title="Background"></span>
            <span class="swatch" [style.background]="presets[key].colors.text" title="Text"></span>
          </div>

          <!-- Preset Info -->
          <div class="preset-info">
            <div class="preset-name">
              <span>{{ presets[key].name }}</span>
              <span class="active-dot" *ngIf="activePreset() === key">✓ Active</span>
            </div>
            <p class="preset-desc">{{ presets[key].description }}</p>
          </div>

          <!-- Contrast & Accessibility Footer -->
          <div class="preset-card-footer">
            <span class="preset-contrast-tag">
              <span class="contrast-dot pass"></span>
              WCAG AA ({{ getPresetContrast(key).ratio | number:'1.1-1' }}:1)
            </span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="filteredPresets().length === 0">
        <p>No presets found matching your filter criteria.</p>
        <button type="button" class="action-btn" (click)="themeSearch.set(''); themeCategory.set('all')">
          Reset Filters
        </button>
      </div>
    </div>
  `,
  styles: [`
    .themes-page-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      width: 100%;
      box-sizing: border-box;
    }

    .section-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid var(--surface-border);
      padding-bottom: 1rem;
      flex-wrap: wrap;
    }

    .eyebrow-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--gold-accent);
      background: var(--gold-light);
      border: 1px solid rgba(154, 123, 56, 0.3);
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-sm, 4px);
      margin-bottom: 0.35rem;
    }

    .section-title {
      font-size: 1.55rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
      line-height: 1.25;
    }

    .section-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.85rem;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .action-btn:hover {
      background: var(--surface-raised);
      border-color: var(--gold-accent);
    }

    .btn-svg {
      width: 14px;
      height: 14px;
    }

    /* Toolbar */
    .theme-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .category-filters {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .filter-pill {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .filter-pill:hover {
      background: var(--surface-raised);
      color: var(--text-primary);
    }

    .filter-pill.is-active {
      background: var(--gold-accent);
      color: var(--text-inverse, #ffffff);
      border-color: var(--gold-accent);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      padding: 0.35rem 0.65rem;
      min-width: 220px;
    }

    .search-icon {
      width: 14px;
      height: 14px;
      color: var(--text-muted);
    }

    .theme-search-input {
      border: none;
      background: transparent;
      font-size: 0.8rem;
      color: var(--text-primary);
      outline: none;
      width: 100%;
    }

    /* Presets Grid */
    .presets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }

    .preset-item {
      border: 2px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1rem;
      cursor: pointer;
      background: var(--surface-root);
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .preset-item:hover {
      border-color: var(--gold-accent);
      transform: translateY(-1px);
    }

    .preset-item.is-active {
      border-color: var(--gold-accent);
      background: var(--surface-card);
      box-shadow: 0 0 0 1px var(--gold-accent);
    }

    .preset-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .category-badge {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 0.15rem 0.45rem;
      border-radius: 3px;
      background: var(--surface-raised);
      color: var(--text-muted);
      border: 1px solid var(--surface-border);
    }

    .category-badge[data-cat="seasonal"] {
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
    }

    .category-badge[data-cat="festival"] {
      background: rgba(217, 119, 6, 0.1);
      color: #d97706;
    }

    .favorite-star-btn {
      background: none;
      border: none;
      font-size: 1.15rem;
      line-height: 1;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.1rem;
      transition: transform 0.15s ease, color 0.15s ease;
    }

    .favorite-star-btn:hover {
      transform: scale(1.15);
      color: var(--gold-accent);
    }

    .favorite-star-btn.is-fav {
      color: var(--gold-accent);
    }

    .preset-swatches {
      display: flex;
      gap: 0.35rem;
    }

    .swatch {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.15);
    }

    .preset-name {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .active-dot {
      font-size: 0.72rem;
      color: var(--status-success);
      font-weight: 700;
    }

    .preset-desc {
      font-size: 0.78rem;
      color: var(--text-muted);
      line-height: 1.4;
      margin-top: 0.25rem;
    }

    .preset-card-footer {
      border-top: 1px solid var(--surface-border);
      padding-top: 0.5rem;
      display: flex;
      align-items: center;
    }

    .preset-contrast-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.7rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    .contrast-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .contrast-dot.pass {
      background: var(--status-success);
    }

    .empty-state {
      text-align: center;
      padding: 2.5rem 1rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
  `],
})
export class AppearanceThemesComponent {
  readonly themeService = inject(ThemeService);

  readonly presets = PRESET_THEMES;
  readonly allPresetKeys = Object.keys(PRESET_THEMES) as Array<Exclude<ThemePreset, 'custom'>>;
  readonly activePreset = this.themeService.currentPreset;

  readonly themeSearch = signal<string>('');
  readonly themeCategory = signal<'all' | 'professional' | 'seasonal' | 'festival' | 'favorites'>('all');
  readonly successMessage = signal<string | null>(null);

  readonly filteredPresets = computed(() => {
    const search = this.themeSearch().toLowerCase().trim();
    const category = this.themeCategory();
    const favs = this.themeService.favorites();

    return this.allPresetKeys.filter((key) => {
      const preset = this.presets[key];
      if (!preset) return false;

      if (category === 'favorites') {
        if (!favs.includes(key)) return false;
      } else if (category !== 'all' && preset.category !== category) {
        return false;
      }

      if (search) {
        const matchName = preset.name.toLowerCase().includes(search);
        const matchDesc = preset.description.toLowerCase().includes(search);
        if (!matchName && !matchDesc) return false;
      }

      return true;
    });
  });

  selectPreset(preset: Exclude<ThemePreset, 'custom'>): void {
    this.themeService.setPreset(preset);
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

  resetTheme(): void {
    this.themeService.resetTheme();
    this.showSuccess('Reset to default Premium Hospitality theme.');
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

