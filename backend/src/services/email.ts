import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
  const from = process.env.EMAIL_FROM || 'info@cranis2.com';
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Verify your CRANIS2 account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
        <h1 style="font-size: 1.5rem; color: #e4e4e7; margin-bottom: 1rem;">
          Welcome to <span style="color: #3b82f6;">CRANIS2</span>
        </h1>
        <p style="color: #8b8d98; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
          Thanks for signing up. Please verify your email address by clicking the button below.
        </p>
        <a href="${verifyUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">
          Verify Email Address
        </a>
        <p style="color: #8b8d98; font-size: 0.8rem; margin-top: 1.5rem;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #2a2d3a; margin: 2rem 0;" />
        <p style="color: #8b8d98; font-size: 0.75rem;">
          CRANIS2 — CRA Compliance Made Simple
        </p>
      </div>
    `,
  });
}
