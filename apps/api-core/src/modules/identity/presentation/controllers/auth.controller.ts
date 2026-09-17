import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthenticationService } from '../../application/services/authentication.service';
import { TokenService } from '../../application/services/token.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { parseCookie } from '../../../../common/utils/cookie.util';
import {
  ApiSuccessResponse,
  AuthenticationResponse,
  MeResponse,
  LogoutResponse,
} from '@hms/api-contracts';

const REFRESH_COOKIE_NAME = 'hms_refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';
const REFRESH_COOKIE_MAX_AGE_MS = 28800 * 1000; // 8 hours

@ApiTags('Authentication & Identity')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 429, description: 'Too many authentication attempts' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<AuthenticationResponse>> {
    const ipAddress = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
    const userAgent = req.headers['user-agent'] as string | undefined;

    const { response, isWeb, rawRefreshToken } = await this.authService.login({
      email: dto.email,
      password: dto.password,
      clientType: dto.clientType,
      deviceInfo: dto.deviceInfo,
      ipAddress,
      userAgent,
    });

    if (isWeb) {
      res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
        sameSite: 'strict',
        path: REFRESH_COOKIE_PATH,
        maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      });
    }

    return createApiResponse(response, req);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and obtain new RS256 access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or reused refresh token' })
  @ApiResponse({ status: 403, description: 'CSRF validation failed' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<AuthenticationResponse>> {
    const ipAddress = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
    const cookieToken = parseCookie(req.headers.cookie, REFRESH_COOKIE_NAME);
    const candidateToken = dto.refreshToken || cookieToken;

    if (!candidateToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const isWeb = !dto.refreshToken;
    const origin = req.headers.origin as string | undefined;
    const referer = req.headers.referer as string | undefined;

    const { response, rawRefreshToken } = await this.authService.refresh({
      rawRefreshToken: candidateToken,
      clientType: isWeb ? 'web' : 'native',
      ipAddress,
      origin,
      referer,
    });

    if (isWeb) {
      res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
        sameSite: 'strict',
        path: REFRESH_COOKIE_PATH,
        maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      });
    }

    return createApiResponse(response, req);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active session and clear authentication cookie' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<LogoutResponse>> {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const claims = await this.tokenService.validateAccessToken(token);
        if (claims?.sid) {
          await this.authService.logout(claims.sid);
        }
      } catch {
        // Idempotent logout: ignore invalid or already revoked tokens
      }
    }

    // Always clear the browser refresh cookie
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    });

    return createApiResponse({ success: true, message: 'Logged out successfully.' }, req);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user and active context' })
  @ApiResponse({ status: 200, description: 'Active identity returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@Req() req: Request): Promise<ApiSuccessResponse<MeResponse>> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required.');
    }

    const token = authHeader.slice(7).trim();
    const claims = await this.tokenService.validateAccessToken(token);
    const data = await this.authService.getMe(claims.sub, claims.sid);

    return createApiResponse(data, req);
  }
}
