/**
 * Email Notification Templates & Unsubscribe Manager
 * Ensures CAN-SPAM, CASL, and GDPR compliance with mandatory 1-click unsubscribe links.
 */

export interface EmailNotificationPreferences {
  rateUpdates: boolean;
  securityAlerts: boolean;
  systemAnnouncements: boolean;
  unsubscribedAll: boolean;
  updatedAt: string;
}

const PREF_STORAGE_KEY = 'basechan_email_notification_prefs';

export function getEmailPreferences(): EmailNotificationPreferences {
  try {
    const raw = localStorage.getItem(PREF_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse email preferences:', e);
  }

  return {
    rateUpdates: true,
    securityAlerts: true,
    systemAnnouncements: true,
    unsubscribedAll: false,
    updatedAt: new Date().toISOString(),
  };
}

export function saveEmailPreferences(prefs: Partial<EmailNotificationPreferences>): EmailNotificationPreferences {
  const current = getEmailPreferences();
  const updated: EmailNotificationPreferences = {
    ...current,
    ...prefs,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save email preferences:', e);
  }

  return updated;
}

export function unsubscribeAllEmails(): EmailNotificationPreferences {
  return saveEmailPreferences({
    rateUpdates: false,
    securityAlerts: false,
    systemAnnouncements: false,
    unsubscribedAll: true,
  });
}

/**
 * Builds standard system notification email HTML with compliant footer and Unsubscribe link.
 */
export function buildNotificationEmail(options: {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyContentHtml: string;
  notificationType: 'rateUpdates' | 'securityAlerts' | 'systemAnnouncements';
}): { subject: string; html: string; text: string; headers: Record<string, string> } {
  const unsubscribeUrl = `https://basechan-cms.web.app/unsubscribe?email=${encodeURIComponent(options.recipientEmail)}&type=${options.notificationType}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${options.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <!-- Header -->
    <div style="border-b: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
      <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">Basechan CMS</h2>
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700;">Notification</span>
    </div>

    <!-- Body -->
    <div style="font-size: 14px; line-height: 1.6; color: #334155;">
      <p style="margin-top: 0;">Hello ${options.recipientName || 'Team Member'},</p>
      ${options.bodyContentHtml}
    </div>

    <!-- Mandatory Compliant Unsubscribe Footer -->
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; line-height: 1.5;">
      <p style="margin: 0 0 8px 0;">This email was sent to <strong>${options.recipientEmail}</strong> as part of your Basechan CMS internal notification settings.</p>
      <p style="margin: 0;">
        <a href="${unsubscribeUrl}" style="color: #059669; text-decoration: underline; font-weight: 600;">Unsubscribe from these emails</a>
        &nbsp;•&nbsp;
        <a href="https://basechan-cms.web.app/privacy" style="color: #64748b; text-decoration: underline;">Privacy Policy</a>
        &nbsp;•&nbsp;
        Basechan International
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Basechan CMS - ${options.subject}

Hello ${options.recipientName || 'Team Member'},

${options.bodyContentHtml.replace(/<[^>]+>/g, '')}

---
Sent to ${options.recipientEmail}
To unsubscribe, visit: ${unsubscribeUrl}
Basechan International
  `.trim();

  return {
    subject: options.subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@basechaninternational.com?subject=Unsubscribe%20${options.recipientEmail}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
