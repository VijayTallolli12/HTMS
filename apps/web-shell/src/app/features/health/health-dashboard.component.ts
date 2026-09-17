import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthService } from '../../core/services/health.service';

@Component({
  selector: 'app-health-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './health-dashboard.component.html',
  styleUrls: ['./health-dashboard.component.css'],
})
export class HealthDashboardComponent implements OnInit {
  protected readonly healthService = inject(HealthService);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.healthService.fetchHealth();
  }
}
