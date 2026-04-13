import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for outreach click tracking.
 * Routes through adashield.net so tracking URLs match the sending domain,
 * avoiding spam filter warnings about mismatched link domains.
 * The Railway API handles click recording and redirects to the report URL.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return NextResponse.redirect(`${apiUrl}/api/outreach/click/${params.token}`, {
    status: 302,
  });
}
