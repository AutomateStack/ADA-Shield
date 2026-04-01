import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-api-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SendAdminEmailPayload = {
  to?: string;
  subject?: string;
  message?: string;
  siteId?: string;
  siteName?: string | null;
  siteUrl?: string | null;
};

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
  const emailMatch = candidate.match(/<([^>]+)>/);
  const email = (emailMatch ? emailMatch[1] : candidate).trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';

  const blockedDomains = new Set([
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'aol.com',
    'live.com',
  ]);

  if (!domain || blockedDomains.has(domain)) {
    return 'ADA Shield <onboarding@resend.dev>';
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

  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  if (!resendApiKey || resendApiKey === 're_xxx') {
    return jsonResponse(500, { error: 'RESEND_API_KEY is not configured' });
  }

  const configuredFrom = Deno.env.get('EMAIL_FROM') || 'ADA Shield <onboarding@resend.dev>';
  const from = getVerifiedFromAddress(configuredFrom);

  let payload: SendAdminEmailPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const to = String(payload.to || '').trim();
  const subject = sanitizeSubject(payload.subject);
  const message = String(payload.message || '').trim();
  const siteName = escapeHtml(payload.siteName || 'your website');
  const siteUrl = escapeHtml(payload.siteUrl || '');

  if (!to || !subject || !message) {
    return jsonResponse(400, { error: 'to, subject, and message are required' });
  }

  const resend = new Resend(resendApiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;">
      <h1 style="font-size:18px;margin:0 0 12px;color:#0f172a;">${subject}</h1>
      <p style="margin:0 0 16px;color:#475569;font-size:13px;">Regarding ${siteName}${siteUrl ? ` (${siteUrl})` : ''}</p>
      <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(message)}</div>
      <p style="margin:20px 0 0;color:#64748b;font-size:12px;">Sent via ADA Shield</p>
    </div>
  </div>
</body>
</html>`,
    });

    if (error) {
      return jsonResponse(500, { error: error.message || 'Failed to send email' });
    }

    return jsonResponse(200, {
      success: true,
      messageId: data?.id || null,
      from,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send email';
    return jsonResponse(500, { error: msg });
  }
});
