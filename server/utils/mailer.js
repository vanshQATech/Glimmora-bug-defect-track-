const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return null;
    }
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
}

async function sendInviteEmail({ to, inviterName, projectName, token }) {
  const transport = getTransporter();
  if (!transport) {
    console.error(`[Mailer] SMTP not configured. Check SMTP_HOST, SMTP_USER, SMTP_PASS in .env`);
    return { success: false, error: 'SMTP not configured. Check server .env file.' };
  }

  // Verify SMTP connection first
  try {
    await transport.verify();
    console.log('[Mailer] SMTP connection verified');
  } catch (err) {
    console.error(`[Mailer] SMTP connection failed:`, err.message);
    // Reset transporter so it can be recreated on next attempt
    transporter = null;
    return { success: false, error: `SMTP connection failed: ${err.message}` };
  }

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const registerLink = `${appUrl}/register?invitation=${token}`;

  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: projectName
        ? `You've been invited to join "${projectName}" on Glimmora DefectDesk`
        : `You've been invited to join Glimmora DefectDesk`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #4f46e5; font-size: 24px; margin: 0;">Glimmora DefectDesk</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Bug Tracking & Work Management</p>
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
            <h2 style="color: #111827; font-size: 18px; margin: 0 0 16px;">You're invited!</h2>
            <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
              <strong>${inviterName}</strong> has invited you to ${projectName ? `join the project <strong>"${projectName}"</strong> on` : 'join'} Glimmora DefectDesk.
            </p>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              Click the button below to create your account and get started.
            </p>
            <div style="text-align: center;">
              <a href="${registerLink}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
              Or copy this link: <a href="${registerLink}" style="color: #4f46e5;">${registerLink}</a>
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log(`[Mailer] Email sent to ${to} — Message ID: ${info.messageId}, Response: ${info.response}`);
    return { success: true };
  } catch (err) {
    console.error(`[Mailer] Failed to send email to ${to}:`, err.message);
    return { success: false, error: `Failed to send: ${err.message}` };
  }
}

async function sendNotificationEmail({ to, subject, message, entityType, entityId }) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[Email skipped - SMTP not configured] Notification to ${to}`);
    return false;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const viewLink = entityType && entityId
    ? `${appUrl}/${entityType === 'project' ? 'projects' : entityType + 's'}/${entityId}`
    : appUrl;

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `[Glimmora DefectDesk] ${subject}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #4f46e5; font-size: 24px; margin: 0;">Glimmora DefectDesk</h1>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
          <h2 style="color: #111827; font-size: 18px; margin: 0 0 16px;">${subject}</h2>
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">${message}</p>
          <div style="text-align: center;">
            <a href="${viewLink}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              View in DefectDesk
            </a>
          </div>
        </div>
      </div>
    `,
  });

  return true;
}

module.exports = { sendInviteEmail, sendNotificationEmail };
