import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';

interface EncryptedCredential {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
}

@Injectable()
export class PaymentGatewayCredentialVault {
  private encryptionKey(): Buffer {
    const configured = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
    if (!configured || configured.trim().length < 32) {
      throw new InternalServerErrorException('Payment credential encryption is not configured.');
    }
    return createHash('sha256').update(configured, 'utf8').digest();
  }

  encrypt(credentials: Record<string, string>): EncryptedCredential {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
    return {
      version: 1,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  decrypt(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object') return {};
    const encrypted = value as Partial<EncryptedCredential>;
    if (encrypted.version !== 1 || encrypted.algorithm !== 'aes-256-gcm' || !encrypted.iv || !encrypted.tag || !encrypted.ciphertext) {
      throw new BadRequestException('Stored payment credentials are invalid.');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(encrypted.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      const parsed: unknown = JSON.parse(plaintext);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid credential payload');
      return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    } catch {
      throw new InternalServerErrorException('Payment credentials could not be decrypted.');
    }
  }
}
