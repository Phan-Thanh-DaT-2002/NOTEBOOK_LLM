import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. Handle CORS Preflight (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 2. Bypass static files and Next.js internal paths
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.endsWith('.traineddata') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  ) {
    return NextResponse.next();
  }

  // 3. Allow localhost bypass (developer direct access)
  const host = request.headers.get('host') || '';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }

  const apiKey = process.env.TUNNEL_API_KEY;
  // If no API Key is configured in environment, let requests pass through
  if (!apiKey) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }

  // 4. Check for valid credentials (cookie, query string, or Bearer Token)
  const cookieKey = request.cookies.get('notebook_auth')?.value;
  const queryKey = request.nextUrl.searchParams.get('key');
  
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  let headerKey = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    headerKey = authHeader.substring(7).trim();
  }

  const isValid = cookieKey === apiKey || queryKey === apiKey || headerKey === apiKey;

  if (isValid) {
    let response;
    // If query key is provided, set cookie and redirect to a clean URL without query parameters
    if (queryKey === apiKey && !cookieKey) {
      response = NextResponse.redirect(new URL(pathname, request.url));
      response.cookies.set('notebook_auth', apiKey, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    } else {
      response = NextResponse.next();
    }
    
    // Add CORS headers to validated request
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
    return response;
  }

  // Allow accessing the login page
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Block unauthorized API requests with 401 Unauthorized
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
      { status: 401 }
    );
  }

  // Redirect page requests to login page
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (if any auth route exists)
     */
    '/((?!api/auth).*)',
  ],
};
