import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../../application/services/token.service';
import { AuthorizationService } from '../../application/services/authorization.service';
import { IS_PUBLIC_KEY } from '../decorators/authz.decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        type: 'https://hms.enterprise/errors/authentication/missing-token',
        title: 'Unauthorized: Missing or Malformed Authorization Header',
        status: 401,
        detail: 'A valid Bearer access token is required to access this resource.',
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException({
        type: 'https://hms.enterprise/errors/authentication/empty-token',
        title: 'Unauthorized: Empty Access Token',
        status: 401,
        detail: 'Access token cannot be empty.',
      });
    }

    // 401 Boundary: Validate JWT cryptographically and against Redis session revocation
    const claims = await this.tokenService.validateAccessToken(token);

    // Extract tenant context from headers with claims fallback
    const hotelGroupId =
      (request.headers['x-hotel-group-id'] as string) || claims.actx?.hotelGroupId || null;
    const propertyId =
      (request.headers['x-property-id'] as string) || claims.actx?.propertyId || null;
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      '';

    // Hydrate immutable SecurityContext
    const securityContext = await this.authorizationService.resolveSecurityContext(
      claims.sub,
      claims.sid,
      { hotelGroupId, propertyId },
      correlationId,
    );

    // Attach to request pipeline
    request.user = claims;
    request.securityContext = securityContext;

    return true;
  }
}
