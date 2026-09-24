import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  ElementRef,
  HostListener,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PropertyDto } from '@hms/api-contracts';

@Component({
  selector: 'hms-property-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="hms-property-selector"
      [class.is-open]="isOpen()"
      #containerRef
    >
      <!-- Trigger Button (Closed State) -->
      <button
        #triggerBtn
        type="button"
        class="selector-trigger"
        [class.is-disabled]="properties.length === 0"
        (click)="toggleOpen()"
        (keydown)="onTriggerKeydown($event)"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="listbox"
        [attr.aria-label]="
          activeProperty
            ? 'Active Property: ' + activeProperty.name + ' (' + activeProperty.code + ')'
            : 'Select Property'
        "
        [title]="
          activeProperty
            ? activeProperty.name + ' (' + activeProperty.code + ')'
            : 'Select Property'
        "
      >
        <div class="trigger-content">
          <span class="property-code">{{ activeProperty?.code || 'PORTFOLIO' }}</span>
          <span class="property-name">{{ activeProperty?.name || 'Select Property' }}</span>
        </div>

        <svg
          class="selector-chevron"
          [class.is-rotated]="isOpen()"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- Dropdown Menu (Open State) -->
      <div
        *ngIf="isOpen()"
        class="selector-dropdown"
        role="listbox"
        [attr.aria-label]="'Available properties'"
        tabindex="-1"
      >
        <div class="dropdown-header">
          <span class="header-title">PROPERTIES</span>
          <span class="header-badge">{{ properties.length }} AVAILABLE</span>
        </div>

        <div class="dropdown-list" role="presentation">
          <button
            type="button"
            *ngFor="let p of properties; let i = index"
            class="property-option"
            [class.is-selected]="p.id === activeProperty?.id"
            [class.is-focused]="i === focusedIndex()"
            role="option"
            [attr.aria-selected]="p.id === activeProperty?.id"
            (click)="selectProperty(p)"
            (mouseenter)="focusedIndex.set(i)"
            (keydown)="onOptionKeydown($event, p, i)"
          >
            <!-- Checkmark Indicator -->
            <div class="option-check" aria-hidden="true">
              <svg
                *ngIf="p.id === activeProperty?.id"
                class="check-svg"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3.5 8.5l3 3 6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <!-- Property Meta -->
            <div class="option-info">
              <span class="option-name">{{ p.name }}</span>
              <span class="option-code">{{ p.code }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        flex-shrink: 0;
      }

      .hms-property-selector {
        position: relative;
        width: 240px;
        box-sizing: border-box;
      }

      /* Closed Trigger Button */
      .selector-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
        height: 38px;
        padding: 0.25rem 0.65rem;
        background: var(--surface-raised, #f8fafc);
        border: 1px solid var(--surface-border, #e2e8f0);
        border-radius: var(--radius-sm, 6px);
        cursor: pointer;
        outline: none;
        transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        box-sizing: border-box;
        text-align: left;
      }

      .selector-trigger:hover:not(.is-disabled) {
        background: var(--surface-card, #ffffff);
        border-color: var(--gold-accent, #9a7b38);
      }

      .selector-trigger:focus-visible {
        border-color: var(--gold-accent, #9a7b38);
        box-shadow: 0 0 0 2px var(--gold-ring, rgba(154, 123, 56, 0.25));
        background: var(--surface-card, #ffffff);
      }

      .selector-trigger.is-disabled {
        cursor: default;
      }

      .trigger-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
        flex: 1;
        overflow: hidden;
      }

      .property-code {
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--gold-accent, #9a7b38);
        line-height: 1;
        margin-bottom: 2px;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .property-name {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-primary, #0f172a);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .selector-chevron {
        width: 14px;
        height: 14px;
        color: var(--text-muted, #64748b);
        flex-shrink: 0;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease;
      }

      .selector-trigger:hover .selector-chevron {
        color: var(--gold-accent, #9a7b38);
      }

      .selector-chevron.is-rotated {
        transform: rotate(180deg);
        color: var(--gold-accent, #9a7b38);
      }

      /* Open Dropdown Menu */
      .selector-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        width: 260px;
        background: var(--surface-card, #ffffff);
        border: 1px solid var(--surface-border, #e2e8f0);
        border-radius: var(--radius-md, 8px);
        box-shadow: var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08));
        z-index: 1050;
        overflow: hidden;
        animation: selectorFadeIn 0.15s ease-out;
      }

      @keyframes selectorFadeIn {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .dropdown-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem 0.4rem;
        background: var(--surface-raised, #f8fafc);
        border-bottom: 1px solid var(--surface-border-subtle, #f1f5f9);
      }

      .header-title {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: var(--text-muted, #64748b);
        text-transform: uppercase;
      }

      .header-badge {
        font-size: 0.6rem;
        font-weight: 600;
        color: var(--gold-accent, #9a7b38);
        background: var(--gold-light, #fdf8ee);
        border: 1px solid rgba(154, 123, 56, 0.25);
        padding: 0.1rem 0.35rem;
        border-radius: 4px;
        line-height: 1;
      }

      .dropdown-list {
        max-height: 240px;
        overflow-y: auto;
        padding: 0.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .property-option {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        width: 100%;
        padding: 0.5rem 0.55rem;
        border: 1px solid transparent;
        border-radius: var(--radius-sm, 6px);
        background: transparent;
        cursor: pointer;
        text-align: left;
        outline: none;
        transition: background 0.12s ease, border-color 0.12s ease;
        box-sizing: border-box;
      }

      .property-option:hover,
      .property-option.is-focused {
        background: var(--surface-raised, #f8fafc);
        border-color: var(--surface-border-subtle, #f1f5f9);
      }

      .property-option.is-selected {
        background: var(--gold-light, #fdf8ee);
        border-color: rgba(154, 123, 56, 0.2);
      }

      .property-option:focus-visible {
        border-color: var(--gold-accent, #9a7b38);
        box-shadow: 0 0 0 2px var(--gold-ring, rgba(154, 123, 56, 0.25));
      }

      .option-check {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .check-svg {
        width: 14px;
        height: 14px;
        color: var(--gold-accent, #9a7b38);
      }

      .option-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
        overflow: hidden;
      }

      .option-name {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-primary, #0f172a);
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .is-selected .option-name {
        color: var(--gold-dark, #83672d);
      }

      .option-code {
        font-size: 0.65rem;
        color: var(--text-muted, #64748b);
        line-height: 1.2;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-top: 1px;
      }

      /* Responsive Adaptations */
      @media (max-width: 1024px) {
        .hms-property-selector {
          width: 180px;
        }
        .selector-dropdown {
          width: 230px;
        }
      }

      @media (max-width: 768px) {
        .hms-property-selector {
          width: 150px;
        }
        .property-code {
          font-size: 0.58rem;
        }
        .property-name {
          font-size: 0.76rem;
        }
        .selector-dropdown {
          width: 220px;
        }
      }

      @media (max-width: 480px) {
        .hms-property-selector {
          width: 125px;
        }
        .selector-trigger {
          height: 34px;
          padding: 0.2rem 0.45rem;
        }
        .property-code {
          display: none;
        }
        .property-name {
          font-size: 0.74rem;
        }
        .selector-dropdown {
          width: 210px;
        }
      }
    `,
  ],
})
export class HmsPropertySelectorComponent {
  @Input() properties: PropertyDto[] = [];
  @Input() activeProperty: PropertyDto | null = null;
  @Output() propertyChange = new EventEmitter<string>();

  @ViewChild('containerRef') containerRef!: ElementRef<HTMLElement>;
  @ViewChild('triggerBtn') triggerBtn!: ElementRef<HTMLButtonElement>;

  readonly isOpen = signal<boolean>(false);
  readonly focusedIndex = signal<number>(-1);

  toggleOpen(): void {
    if (this.properties.length === 0) {
      return;
    }
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);
    if (nextState) {
      const idx = this.properties.findIndex((p) => p.id === this.activeProperty?.id);
      this.focusedIndex.set(idx >= 0 ? idx : 0);
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.focusedIndex.set(-1);
  }

  selectProperty(property: PropertyDto): void {
    this.close();
    this.propertyChange.emit(property.id);
    this.triggerBtn?.nativeElement?.focus();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.properties.length === 0) return;

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.toggleOpen();
    } else if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.close();
    }
  }

  onOptionKeydown(event: KeyboardEvent, property: PropertyDto, index: number): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (index + 1) % this.properties.length;
      this.focusedIndex.set(next);
      this.focusOption(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = (index - 1 + this.properties.length) % this.properties.length;
      this.focusedIndex.set(prev);
      this.focusOption(prev);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectProperty(property);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.triggerBtn?.nativeElement?.focus();
    } else if (event.key === 'Tab') {
      this.close();
    }
  }

  private focusOption(index: number): void {
    setTimeout(() => {
      const options = this.containerRef?.nativeElement?.querySelectorAll<HTMLButtonElement>(
        '.property-option',
      );
      if (options && options[index]) {
        options[index].focus();
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as HTMLElement;
    if (this.containerRef && !this.containerRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('window:keydown.escape')
  onWindowEscape(): void {
    if (this.isOpen()) {
      this.close();
      this.triggerBtn?.nativeElement?.focus();
    }
  }
}
