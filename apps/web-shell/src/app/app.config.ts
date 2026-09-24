import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { correlationIdInterceptor } from './core/interceptors/correlation-id.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AppTitleStrategy } from './core/services/application-branding.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([correlationIdInterceptor, authInterceptor])),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
