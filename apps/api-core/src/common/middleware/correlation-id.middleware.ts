import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { generateUuidV7 } from '@hms/shared';
import { HTTP_HEADERS } from '@hms/api-contracts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingCorrelationId = req.headers[HTTP_HEADERS.CORRELATION_ID];
    const correlationId =
      typeof existingCorrelationId === 'string' && existingCorrelationId.trim().length > 0
        ? existingCorrelationId.trim()
        : `corr_${generateUuidV7()}`;

    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}
