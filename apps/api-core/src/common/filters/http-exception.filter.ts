import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemDetails, InvalidParam } from '@hms/api-contracts';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = request.correlationId || (request.headers['x-correlation-id'] as string);
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected server error occurred. Please contact system support.';
    let code = 'INTERNAL_SERVER_ERROR';
    let type = 'https://api.enterprise-hms.com/errors/internal-server-error';
    let invalidParams: InvalidParam[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        detail = exceptionResponse;
        title = exception.message;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, any>;
        title = body.error || exception.message || 'HTTP Exception';
        detail = Array.isArray(body.message) ? body.message.join('; ') : body.message || title;
        code = body.code || this.mapStatusToCode(status);

        if (Array.isArray(body.message)) {
          invalidParams = body.message.map((msg: string) => ({
            name: msg.split(' ')[0] || 'parameter',
            reason: msg,
          }));
        }
      }

      type = `https://api.enterprise-hms.com/errors/${code.toLowerCase().replace(/_/g, '-')}`;
    } else if (exception instanceof Error) {
      detail = exception.message;
      this.logger.error(
        `Unhandled Exception [${correlationId}]: ${exception.message}`,
        exception.stack,
      );
    }

    const problemDetails: ProblemDetails = {
      type,
      title,
      status,
      detail,
      instance: request.originalUrl || request.url,
      code,
      invalidParams,
      timestamp,
      correlationId,
    };

    response.status(status).contentType('application/problem+json').json(problemDetails);
  }

  private mapStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'RESOURCE_CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      default:
        return 'HTTP_ERROR';
    }
  }
}
