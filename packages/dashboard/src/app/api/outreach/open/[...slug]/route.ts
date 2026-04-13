import { NextRequest, NextResponse } from 'next/server';

// Minimal 1×1 transparent GIF — returned as fallback if the upstream call fails.
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

/**
 * Proxy for outreach open (pixel) tracking.
 * The slug catches "UUID.gif" — Next.js cannot match a dynamic segment that
 * contains a literal dot, so a catch-all is used instead.
 *
 * Routes through adashield.net so tracking image URLs match the sending
 * domain, avoiding spam-filter warnings about mismatched image hosts.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string[] } },
) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const segment = params.slug?.[0] ?? '';

  try {
    const upstream = await fetch(`${apiUrl}/api/outreach/open/${segment}`, {
      cache: 'no-store',
    });
    const buffer = await upstream.arrayBuffer();
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}
