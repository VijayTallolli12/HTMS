import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <table class="hms-table" [class.hms-table--compact]="compact">
      <thead>
        <tr>
          <th *ngFor="let col of columns">{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let row of rows; trackBy: trackByFn" (click)="rowClick.emit(row)">
          <td *ngFor="let col of columns">
            <ng-container *ngIf="col.cellTemplate; else defaultCell">
              <ng-container [ngTemplateOutlet]="col.cellTemplate" [ngTemplateOutletContext]="{$implicit: row[col.field], value: row[col.field], row: row}"></ng-container>
            </ng-container>
            <ng-template #defaultCell>{{ row[col.field] }}</ng-template>
          </td>
        </tr>
      </tbody>
    </table>
  `,
  styles: [],
})
export class HmsDataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() rows: any[] = [];
  @Input() compact = false;
  @Output() rowClick = new EventEmitter<any>();

  trackByFn(index: number): number {
    return index;
  }
}

export interface TableColumn {
  field: string;
  label: string;
  cellTemplate?: any;
}
