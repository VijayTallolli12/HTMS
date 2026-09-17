import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TokenService } from '../../application/services/token.service';
import { JwksResponse } from '@hms/api-contracts';

import { Public } from '../decorators/authz.decorators';

@ApiTags('Cryptographic Discovery')
@Public()
@Controller('.well-known')
export class JwksController {
  constructor(private readonly tokenService: TokenService) {}

  @Get('jwks.json')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'JSON Web Key Set (JWKS) public keys discovery' })
  @ApiResponse({ status: 200, description: 'RFC 7517 JWKS public keys' })
  getJwks(): JwksResponse {
    return this.tokenService.getJwks();
  }
}
