import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { OrganizationService } from '../services/organization.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const orgService = inject(OrganizationService);

  const token = authService.getAccessToken();
  const activeProperty = orgService.activePropertyContext();

  const headers: Record<string, string> = {};

  if (token && !req.headers.has('Authorization')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Inject property context header if property is selected or extract from URL
  if (!req.headers.has('x-property-id')) {
    if (activeProperty?.id) {
      headers['x-property-id'] = activeProperty.id;
    } else {
      // Try to parse propertyId from URL pattern: /properties/:propertyId/
      const match = req.url.match(/\/properties\/([0-9a-fA-F-]{36}|[A-Za-z0-9_-]+)/);
      if (match && match[1]) {
        headers['x-property-id'] = match[1];
      }
    }
  }

  // Ensure Idempotency-Key header is present on financial POST mutations
  if (req.method === 'POST' && !req.headers.has('Idempotency-Key') && !req.headers.has('idempotency-key')) {
    const isFinancialMutation =
      req.url.includes('/finance/folios') ||
      req.url.includes('/charges') ||
      req.url.includes('/payments') ||
      req.url.includes('/checkout');

    if (isFinancialMutation) {
      headers['Idempotency-Key'] = crypto.randomUUID ? crypto.randomUUID() : 'idem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }
  }

  const cloned = req.clone({
    setHeaders: headers,
  });

  return next(cloned);
};
