import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponse, LivenessResponse, ReadinessResponse } from '@hms/api-contracts';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(['health', 'v1/health'])
  @ApiOperation({
    summary: 'Aggregated Health Check',
    description:
      'Returns health status of the API runtime and all connected infrastructure dependencies.',
  })
  @ApiResponse({ status: 200, description: 'Application is operational or degraded' })
  @ApiResponse({ status: 503, description: 'Application core infrastructure is down' })
  async getHealth(@Res() res: Response): Promise<void> {
    const health: HealthResponse = await this.healthService.checkAggregatedHealth();
    const httpStatus = health.status === 'down' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;
    res.status(httpStatus).json(health);
  }

  @Get(['health/liveness', 'v1/health/liveness'])
  @ApiOperation({
    summary: 'Liveness Probe',
    description: 'Kubernetes/process liveness probe. Indicates if the HTTP runtime is alive.',
  })
  @ApiResponse({ status: 200, description: 'Application process is alive' })
  getLiveness(): LivenessResponse {
    return this.healthService.getLiveness();
  }

  @Get(['health/readiness', 'v1/health/readiness'])
  @ApiOperation({
    summary: 'Readiness Probe',
    description:
      'Kubernetes/load-balancer readiness probe. Indicates if the database and core message brokers are reachable.',
  })
  @ApiResponse({ status: 200, description: 'Application is ready to receive traffic' })
  @ApiResponse({ status: 503, description: 'Critical infrastructure dependencies are unreachable' })
  async getReadiness(@Res() res: Response): Promise<void> {
    const readiness: ReadinessResponse = await this.healthService.getReadiness();
    const httpStatus = readiness.status === 'down' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;
    res.status(httpStatus).json(readiness);
  }
}
