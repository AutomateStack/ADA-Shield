import nodemailer from 'npm:nodemailer@6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-api-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SendAdminEmailPayload = {
  to?: string | string[];
  cc?: string[];
  subject?: string;
  message?: string;
  text?: string;
  html?: string;
  siteId?: string;
  siteName?: string | null;
  siteUrl?: string | null;
};

function normalizeEmailList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((email) => String(email || '').trim())
      .filter((email) => email.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,\n]+/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
  }

  return [];
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function sanitizeSubject(value: unknown): string {
  return String(value ?? '').replace(/[\r\n\t]/g, '').slice(0, 200);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function getVerifiedFromAddress(configured: string): string {
  const candidate = String(configured || '').trim();
  return candidate || 'ADA Shield <audit@adashield.net>';
}

  return candidate;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const internalSecret = Deno.env.get('INTERNAL_API_SECRET') || '';
  const headerSecret = req.headers.get('x-internal-api-secret') || '';
  if (!internalSecret || headerSecret !== internalSecret) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const smtpUser = Deno.env.get('SMTP_USER') || '';
  const smtpPass = Deno.env.get('SMTP_PASS') || '';
  if (!smtpUser || !smtpPass) {
    return jsonResponse(500, { error: 'SMTP credentials not configured (SMTP_USER / SMTP_PASS)' });
  }

  const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
  const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587', 10);
  const configuredFrom = Deno.env.get('EMAIL_FROM') || `ADA Shield <${smtpUser}>`;
  const from = getVerifiedFromAddress(configuredFrom);

  let payload: SendAdminEmailPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const toList = normalizeEmailList(payload.to);
  const subject = sanitizeSubject(payload.subject);
  const message = String(payload.message || payload.text || '').trim();
  const text = String(payload.text || payload.message || '').trim();
  const suppliedHtml = typeof payload.html === 'string' ? payload.html.trim() : '';
  const siteName = escapeHtml(payload.siteName || 'your website');
  const siteUrl = escapeHtml(payload.siteUrl || '');

  if (toList.length === 0 || !subject || !message) {
    return jsonResponse(400, { error: 'to, subject, and message are required' });
  }

  const resend = new Resend(resendApiKey);

  try {
    const emailPayload: any = {
      from,
      to: toList,
      subject,
      text,
      html: suppliedHtml || `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 24px; background: #ffffff; font-family: Arial, sans-serif; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 10px; }
    .meta-info { color: #6b7280; font-size: 12px; margin: 0 0 12px; }
    .message-body { font-size: 14px; line-height: 1.6; white-space: pre-line; }
    .footer { margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${subject}</h1>
  ${siteName || siteUrl ? `<p class="meta-info">Regarding ${siteName}${siteUrl ? ` (${siteUrl})` : ''}</p>` : ''}
  <div class="message-body">${escapeHtml(message)}</div>
  <div class="footer">Sent via ADA Shield</div>
</body>
</html>`,
    };

    // Add CC if provided
    if (payload.cc && Array.isArray(payload.cc) && payload.cc.length > 0) {
      emailPayload.cc = payload.cc.filter((email: string) => email && String(email).trim().length > 0).map((email: string) => String(email).trim());
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      requireTLS: smtpPort !== 465,
      tls: { rejectUnauthorized: true },
    });

    const info = await transporter.sendMail(emailPayload);

    return jsonResponse(200, {
      success: true,
      messageId: info.messageId || null,
      from,
      recipientCount: toList.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send email';
    return jsonResponse(500, { error: msg });
  }
});
