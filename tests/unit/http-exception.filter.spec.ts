import { GlobalHttpExceptionFilter } from '../../apps/api-core/src/common/filters/http-exception.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

describe('GlobalHttpExceptionFilter', () => {
  let filter: GlobalHttpExceptionFilter;

  beforeEach(() => {
    filter = new GlobalHttpExceptionFilter();
  });

  it('should serialize HttpException to RFC 7807 problem details', () => {
    const statusMock = jest.fn().mockReturnThis();
    const contentTypeMock = jest.fn().mockReturnThis();
    const jsonMock = jest.fn();

    const mockResponse = {
      status: statusMock,
      contentType: contentTypeMock,
      json: jsonMock,
    } as unknown as Response;

    const mockRequest = {
      originalUrl: '/api/v1/test',
      correlationId: 'corr_test_999',
      headers: {},
    } as unknown as Request;

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    const exception = new HttpException('Validation Failed', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockHost);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(contentTypeMock).toHaveBeenCalledWith('application/problem+json');
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HttpStatus.BAD_REQUEST,
        instance: '/api/v1/test',
        correlationId: 'corr_test_999',
        title: 'Validation Failed',
      }),
    );
  });
});
