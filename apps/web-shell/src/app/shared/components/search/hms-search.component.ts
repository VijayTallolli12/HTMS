import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-search',
  standalone: true,
  imports: [CommonModule],
  template: `
    <input
      class="hms-search"
      [placeholder]="placeholder"
      [value]="value"
      (input)="onInput($event)"
    />
  `,
  styles: [],
})
export class HmsSearchComponent {
  @Input() placeholder = 'Search...';
  @Input() value = '';
  @Output() search = new EventEmitter<string>();

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.search.emit(target.value);
  }
}
