import { CorrelationIdMiddleware } from '../../apps/api-core/src/common/middleware/correlation-id.middleware';
import { Request, Response } from 'express';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should reuse existing X-Correlation-ID from request header', () => {
    const customId = 'corr_custom-12345';
    const req = {
      headers: { 'x-correlation-id': customId },
    } as unknown as Request;

    const setHeaderMock = jest.fn();
    const res = {
      setHeader: setHeaderMock,
    } as unknown as Response;

    const nextMock = jest.fn();

    middleware.use(req, res, nextMock);

    expect(req.correlationId).toBe(customId);
    expect(setHeaderMock).toHaveBeenCalledWith('X-Correlation-ID', customId);
    expect(nextMock).toHaveBeenCalled();
  });

  it('should generate new correlation ID if none provided', () => {
    const req = {
      headers: {},
    } as unknown as Request;

    const setHeaderMock = jest.fn();
    const res = {
      setHeader: setHeaderMock,
    } as unknown as Response;

    const nextMock = jest.fn();

    middleware.use(req, res, nextMock);

    expect(req.correlationId).toBeDefined();
    expect(req.correlationId?.startsWith('corr_')).toBe(true);
    expect(setHeaderMock).toHaveBeenCalledWith('X-Correlation-ID', req.correlationId);
    expect(nextMock).toHaveBeenCalled();
  });
});
