import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { LoginRequest, LoginResponse } from '@oda/shared-types';

function equalsSecret(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && timingSafeEqual(receivedBuffer, expectedBuffer);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(body: LoginRequest): Promise<LoginResponse> {
    const username = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const password = this.configService.get<string>('ADMIN_PASSWORD');
    if (password && equalsSecret(body.username, username) && equalsSecret(body.password, password)) {
      const payload = { username: body.username, sub: 'admin-id' };
      return { access_token: this.jwtService.sign(payload) };
    }
    throw new UnauthorizedException('Credenciais inválidas');
  }
}
