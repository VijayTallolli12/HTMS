import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-kpi-strip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-kpi-strip">
      <div
        class="hms-kpi-card"
        *ngFor="let card of cards"
        (click)="onCardClick(card)"
      >
        <div class="hms-kpi-card__label">{{ card.label }}</div>
        <div class="hms-kpi-card__value">{{ card.value }}</div>
        <div class="hms-kpi-card__desc">{{ card.desc }}</div>
        <div class="hms-kpi-card__footer" *ngIf="card.footer">
          {{ card.footer }}
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class HmsKpiStripComponent {
  @Input() cards: KpiCard[] = [];
  @Output() cardClick = new EventEmitter<KpiCard>();

  onCardClick(card: KpiCard): void {
    this.cardClick.emit(card);
  }
}

export interface KpiCard {
  label: string;
  value: string | number;
  desc: string;
  footer?: string;
}
