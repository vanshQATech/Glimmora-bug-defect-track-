const https = require('https');

function parseFrom(fromStr) {
  if (!fromStr) return { name: 'Glimmora DefectDesk', email: '' };
  const match = fromStr.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: 'Glimmora DefectDesk', email: fromStr.trim() };
}

function brevoSend(to, subject, html) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
    if (!apiKey) return reject(new Error('No Brevo API key configured (BREVO_API_KEY or SMTP_PASS)'));

    const sender = parseFrom(process.env.SMTP_FROM);
    if (!sender.email) return reject(new Error('SMTP_FROM not configured'));

    const body = JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Brevo API ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.setTimeout(15000, () => req.destroy(new Error('Brevo API timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildEntityLink(appUrl, entityType, entityId) {
  if (!entityType) return appUrl;
  if (entityType === 'work_task') return `${appUrl}/workspace`;
  const detailPath = {
    project: 'projects',
    bug: 'bugs',
    task: 'tasks',
    testcase: 'test-cases/case',
    test_case: 'test-cases/case',
  }[entityType];
  if (!detailPath) return appUrl;
  return entityId ? `${appUrl}/${detailPath}/${entityId}` : `${appUrl}/${detailPath}`;
}

async function sendPasswordResetEmail({ to, resetLink }) {
  try {
    const result = await brevoSend(
      to,
      'Reset your Glimmora DefectDesk password',
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#4f46e5;font-size:24px;margin:0;">Glimmora DefectDesk</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:4px;">Bug Tracking & Work Management</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
          <h2 style="color:#111827;font-size:18px;margin:0 0 16px;">Password Reset Request</h2>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 8px;">We received a request to reset the password for your account.</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <div style="text-align:center;">
            <a href="${resetLink}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Reset Password</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center;">Or copy this link: <a href="${resetLink}" style="color:#4f46e5;">${resetLink}</a></p>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>`
    );
    console.log(`[Mailer] Password reset email sent to ${to} — messageId: ${result.messageId}`);
    return { success: true };
  } catch (err) {
    console.error(`[Mailer] Failed to send password reset to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendInviteEmail({ to, inviterName, projectName, token, baseUrl }) {
  const appUrl = baseUrl || process.env.APP_URL || 'http://localhost:5173';
  const registerLink = `${appUrl}/register?invitation=${token}`;
  try {
    const result = await brevoSend(
      to,
      projectName
        ? `You've been invited to join "${projectName}" on Glimmora DefectDesk`
        : `You've been invited to join Glimmora DefectDesk`,
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#4f46e5;font-size:24px;margin:0;">Glimmora DefectDesk</h1>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
          <h2 style="color:#111827;font-size:18px;margin:0 0 16px;">You're invited!</h2>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;"><strong>${inviterName}</strong> has invited you to ${projectName ? `join <strong>"${projectName}"</strong> on` : 'join'} Glimmora DefectDesk.</p>
          <div style="text-align:center;">
            <a href="${registerLink}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Accept Invitation</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center;">Or copy this link: <a href="${registerLink}" style="color:#4f46e5;">${registerLink}</a></p>
        </div>
      </div>`
    );
    console.log(`[Mailer] Invite email sent to ${to} — messageId: ${result.messageId}`);
    return { success: true };
  } catch (err) {
    console.error(`[Mailer] Failed to send invite to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendNotificationEmail({ to, subject, message, entityType, entityId, baseUrl }) {
  const appUrl = baseUrl || process.env.APP_URL || 'http://localhost:5173';
  const viewLink = buildEntityLink(appUrl, entityType, entityId);
  try {
    await brevoSend(
      to,
      `[Glimmora DefectDesk] ${subject}`,
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#4f46e5;font-size:24px;margin:0;">Glimmora DefectDesk</h1>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
          <h2 style="color:#111827;font-size:18px;margin:0 0 16px;">${subject}</h2>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">${message}</p>
          <div style="text-align:center;">
            <a href="${viewLink}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;">View in DefectDesk</a>
          </div>
        </div>
      </div>`
    );
    console.log(`[Mailer] Notification sent to ${to}`);
    return true;
  } catch (err) {
    console.error(`[Mailer] Failed to send notification to ${to}:`, err.message);
    return false;
  }
}

module.exports = { sendInviteEmail, sendNotificationEmail, sendPasswordResetEmail };
