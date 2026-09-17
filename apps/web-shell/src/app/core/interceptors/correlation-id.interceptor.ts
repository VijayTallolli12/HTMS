import { HttpInterceptorFn } from '@angular/common/http';

function generateSimpleId(): string {
  return 'corr_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
}

export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const correlationId = generateSimpleId();
  const cloned = req.clone({
    setHeaders: {
      'x-correlation-id': correlationId,
    },
  });
  return next(cloned);
};
