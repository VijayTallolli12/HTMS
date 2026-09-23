import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-workflow-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-stepper">
      <div class="hms-stepper__step" *ngFor="let step of steps; let i = index">
        <div
          class="hms-stepper__circle"
          [class.hms-stepper__circle--done]="step.status === 'done'"
          [class.hms-stepper__circle--current]="step.status === 'current'"
        >
          {{ step.status === 'done' ? '✓' : step.number }}
        </div>
        <span class="hms-stepper__label">{{ step.label }}</span>
      </div>
      <div class="hms-stepper__line" *ngFor="let step of steps; let j = index" [class.hms-stepper__line--done]="stepLinesDone?.includes(j)"></div>
    </div>
  `,
  styles: [],
})
export class HmsWorkflowStepperComponent {
  @Input() steps: StepperStep[] = [];
  @Input() stepLinesDone: number[] = [];
}

export interface StepperStep {
  number: number;
  label: string;
  status: 'done' | 'current' | 'pending';
}
