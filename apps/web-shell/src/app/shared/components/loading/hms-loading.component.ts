import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-loading">
      <span class="hms-spinner"></span>
      <span>{{ message }}</span>
    </div>
  `,
  styles: [],
})
export class HmsLoadingComponent {
  @Input() message = 'Loading...';
}
