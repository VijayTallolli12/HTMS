import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HealthResponse } from '@hms/api-contracts';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  private readonly http = inject(HttpClient);

  readonly healthState = signal<HealthResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly lastChecked = signal<Date | null>(null);

  fetchHealth(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<HealthResponse>(`${environment.apiBaseUrl}/v1/health`).subscribe({
      next: (response) => {
        this.healthState.set(response);
        this.lastChecked.set(new Date());
        this.isLoading.set(false);
      },
      error: (err) => {
        const message =
          err?.error?.detail || err?.message || 'Failed to communicate with API Core.';
        this.errorMessage.set(message);
        this.isLoading.set(false);
        this.lastChecked.set(new Date());
      },
    });
  }
}
