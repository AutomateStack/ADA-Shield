import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'ADA Shield <thirmal@wealthtalks.in>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'thirmal@wealthtalks.in';
const SUPPORT_EMAIL_CC = process.env.SUPPORT_EMAIL_CC || 'tthirmal@gmail.com';
// Both emails are TO recipients — avoids self-domain filtering on wealthtalks.in when sent via Resend
const SUPPORT_EMAIL_TO = [SUPPORT_EMAIL, SUPPORT_EMAIL_CC];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, topic, message } = body;

    // Basic validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 });
    }

    // Sanitise inputs (truncate to safe limits)
    const safeName = name.trim().slice(0, 100);
    const safeEmail = email.trim().slice(0, 254);
    const safeTopic = topic.trim().slice(0, 100);
    const safeMessage = message.trim().slice(0, 5000);

    if (!RESEND_API_KEY) {
      // Fallback: log and return success so the page doesn't break in dev without Resend
      console.warn('[contact] RESEND_API_KEY not set — email not sent', { safeName, safeEmail, safeTopic });
      return NextResponse.json({ ok: true });
    }

    // Send notification to support inbox
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: SUPPORT_EMAIL_TO,
        reply_to: safeEmail,
        subject: `[ADA Shield Contact] ${safeTopic} — from ${safeName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#e2e8f0;background:#0f172a;padding:24px;border-radius:12px;">
            <h2 style="color:#fff;margin-bottom:4px;">New Contact Form Submission</h2>
            <p style="color:#94a3b8;font-size:14px;margin-top:0;">Via ADA Shield contact page</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:110px;">Name</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;">${safeName}</td></tr>
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Email</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;"><a href="mailto:${safeEmail}" style="color:#818cf8;">${safeEmail}</a></td></tr>
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Topic</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;">${safeTopic}</td></tr>
            </table>
            <div style="background:#1e293b;border-radius:8px;padding:16px;margin-top:8px;">
              <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Message</p>
              <p style="color:#e2e8f0;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">${safeMessage}</p>
            </div>
            <p style="color:#475569;font-size:12px;margin-top:20px;">Reply directly to this email to respond to ${safeName}.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[contact] Resend error', err);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    // Send confirmation to the sender
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [safeEmail],
        subject: "We received your message — ADA Shield",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#e2e8f0;background:#0f172a;padding:24px;border-radius:12px;">
            <h2 style="color:#fff;margin-bottom:4px;">Thanks for reaching out, ${safeName}!</h2>
            <p style="color:#94a3b8;font-size:14px;">We received your message about <strong style="color:#e2e8f0;">${safeTopic}</strong> and will respond within one business day.</p>
            <div style="background:#1e293b;border-radius:8px;padding:16px;margin-top:16px;">
              <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Your message</p>
              <p style="color:#e2e8f0;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">${safeMessage}</p>
            </div>
            <p style="color:#94a3b8;font-size:14px;margin-top:20px;">While you wait, you can <a href="https://adashield.com" style="color:#818cf8;">run a free scan</a> on your website.</p>
            <p style="color:#475569;font-size:12px;margin-top:8px;">— The ADA Shield Team</p>
          </div>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact] Unexpected error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
