import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Mailpit SMTP Connectivity Integration Test', () => {
  it('should successfully establish SMTP connection and send a test message', async () => {
    const transporter = nodemailer.createTransport({
      host: process.env.MAILPIT_HOST || 'localhost',
      port: parseInt(process.env.MAILPIT_SMTP_PORT || '1025', 10),
      secure: false,
    });

    const isVerified = await transporter.verify();
    expect(isVerified).toBe(true);

    const info = await transporter.sendMail({
      from: '"Enterprise HMS" <noreply@enterprise-hms.local>',
      to: 'guest@luxury.com',
      subject: 'Foundation Test Email',
      text: 'W1-T01 Mailpit SMTP connectivity verified successfully.',
    });

    expect(info.messageId).toBeDefined();
  });
});
