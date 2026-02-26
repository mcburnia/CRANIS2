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


export async function sendInviteEmail(to: string, token: string, inviterEmail: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
  const from = process.env.EMAIL_FROM || 'info@cranis2.com';
  const inviteUrl = `${frontendUrl}/accept-invite?token=${token}`;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: "You've been invited to CRANIS2",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
        <h1 style="font-size: 1.5rem; color: #e4e4e7; margin-bottom: 1rem;">
          Welcome to <span style="color: #3b82f6;">CRANIS2</span>
        </h1>
        <p style="color: #8b8d98; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem;">
          <strong style="color: #e4e4e7;">${inviterEmail}</strong> has invited you to join CRANIS2 — the CRA compliance platform for software organisations.
        </p>
        <p style="color: #8b8d98; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
          Click the button below to set up your password and activate your account.
        </p>
        <a href="${inviteUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">
          Set Up Your Account
        </a>
        <p style="color: #8b8d98; font-size: 0.8rem; margin-top: 1.5rem;">
          This link expires in 7 days. If you weren't expecting this invite, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #2a2d3a; margin: 2rem 0;" />
        <p style="color: #8b8d98; font-size: 0.75rem;">
          CRANIS2 — CRA Compliance Made Simple
        </p>
      </div>
    `,
  });
}


export async function sendEscrowAgentInviteEmail(
  to: string,
  agentUsername: string,
  agentPassword: string,
  productName: string,
  orgName: string,
  agentReference: string,
  repoUrl: string,
  inviterEmail: string
): Promise<void> {
  const from = process.env.EMAIL_FROM || 'info@cranis2.com';
  const refRow = agentReference
    ? `<tr><td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0;">Reference</td><td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0;"><code style="background: #27272a; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem;">${agentReference}</code></td></tr>`
    : '';

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: `Escrow access granted — ${productName} (${orgName})`,
    html: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; background: #0a0a0f; color: #e4e4e7;">
        <div style="margin-bottom: 1.5rem;">
          <span style="font-size: 1.25rem; font-weight: 800; color: #e4e4e7;">CRANIS</span><span style="font-size: 1.25rem; font-weight: 800; color: #a855f7;">2</span>
        </div>
        <h2 style="font-size: 1.2rem; color: #e4e4e7; margin-bottom: 1rem;">Escrow Agent Invitation</h2>
        <p style="color: #a1a1aa; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem;">
          <strong style="color: #e4e4e7;">${orgName}</strong> has granted you read-only access to the compliance escrow repository for <strong style="color: #e4e4e7;">${productName}</strong>.
        </p>
        <p style="color: #a1a1aa; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
          This repository contains automatically deposited compliance artifacts including SBOMs, vulnerability reports, licence audits, and CRA documentation.
        </p>
        <div style="background: #18181b; border: 1px solid #2a2d3a; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
          <p style="color: #a1a1aa; font-size: 0.8rem; margin: 0 0 0.75rem 0; text-transform: uppercase; letter-spacing: 0.05em;">Engagement Details</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0; width: 100px;">Organisation</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0; font-weight: 600;">${orgName}</td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0;">Product</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0; font-weight: 600;">${productName}</td>
            </tr>
            ${refRow}
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0;">Repository</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0;"><a href="${repoUrl}" style="color: #3b82f6; text-decoration: none; font-size: 0.85rem;">${repoUrl}</a></td>
            </tr>
          </table>
        </div>
        <div style="background: #18181b; border: 1px solid #2a2d3a; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
          <p style="color: #a1a1aa; font-size: 0.8rem; margin: 0 0 0.75rem 0; text-transform: uppercase; letter-spacing: 0.05em;">Your Credentials</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0; width: 100px;">Username</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0;"><code style="background: #27272a; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem;">${agentUsername}</code></td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0;">Password</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0;"><code style="background: #27272a; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem;">${agentPassword}</code></td>
            </tr>
          </table>
        </div>
        <p style="color: #f59e0b; font-size: 0.85rem; line-height: 1.5; margin-bottom: 1.5rem;">
          &#9888; Please save these credentials securely. For security, the password cannot be retrieved again. If lost, the organisation admin will need to revoke and re-invite you.
        </p>
        <a href="${repoUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">
          Access Escrow Repository
        </a>
        <p style="color: #71717a; font-size: 0.8rem; margin-top: 1.5rem;">
          Invited by ${inviterEmail}. If you weren't expecting this invitation, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #2a2d3a; margin: 2rem 0;" />
        <p style="color: #71717a; font-size: 0.75rem;">
          CRANIS2 — CRA Compliance Made Simple
        </p>
      </div>
    `,
  });
}


export async function sendEscrowAgentAccessEmail(
  to: string,
  agentUsername: string,
  productName: string,
  orgName: string,
  agentReference: string,
  repoUrl: string,
  inviterEmail: string
): Promise<void> {
  const from = process.env.EMAIL_FROM || 'info@cranis2.com';
  const refRow = agentReference
    ? `<tr><td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0;">Reference</td><td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0;"><code style="background: #27272a; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem;">${agentReference}</code></td></tr>`
    : '';

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: `New escrow access — ${productName} (${orgName})`,
    html: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; background: #0a0a0f; color: #e4e4e7;">
        <div style="margin-bottom: 1.5rem;">
          <span style="font-size: 1.25rem; font-weight: 800; color: #e4e4e7;">CRANIS</span><span style="font-size: 1.25rem; font-weight: 800; color: #a855f7;">2</span>
        </div>
        <h2 style="font-size: 1.2rem; color: #e4e4e7; margin-bottom: 1rem;">New Escrow Repository Access</h2>
        <p style="color: #a1a1aa; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
          You have been granted read-only access to a new compliance escrow repository. Log in with your existing Forgejo credentials to view the deposited artifacts.
        </p>
        <div style="background: #18181b; border: 1px solid #2a2d3a; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
          <p style="color: #a1a1aa; font-size: 0.8rem; margin: 0 0 0.75rem 0; text-transform: uppercase; letter-spacing: 0.05em;">Engagement Details</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0; width: 100px;">Organisation</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0; font-weight: 600;">${orgName}</td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0;">Product</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0; font-weight: 600;">${productName}</td>
            </tr>
            ${refRow}
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0;">Repository</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0;"><a href="${repoUrl}" style="color: #3b82f6; text-decoration: none; font-size: 0.85rem;">${repoUrl}</a></td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 0.85rem; padding: 0.35rem 0;">Username</td>
              <td style="color: #e4e4e7; font-size: 0.85rem; padding: 0.35rem 0;"><code style="background: #27272a; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem;">${agentUsername}</code></td>
            </tr>
          </table>
        </div>
        <a href="${repoUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">
          Access Escrow Repository
        </a>
        <p style="color: #71717a; font-size: 0.8rem; margin-top: 1.5rem;">
          Invited by ${inviterEmail}. If you weren't expecting this, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #2a2d3a; margin: 2rem 0;" />
        <p style="color: #71717a; font-size: 0.75rem;">
          CRANIS2 — CRA Compliance Made Simple
        </p>
      </div>
    `,
  });
}
