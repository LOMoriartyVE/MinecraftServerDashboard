import { NextResponse } from 'next/server';

async function handleProxy(req) {
  const targetUrl = req.headers.get('x-target-url') || process.env.NEXT_PUBLIC_DAEMON_URL;
  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing daemon URL. Please configure NEXT_PUBLIC_DAEMON_URL in Vercel or Settings.' }, { status: 400 });
  }

  // Parse path and query parameters from the request
  const { searchParams, pathname } = new URL(req.url);
  // Get relative path after /api/proxy (e.g. /api/servers)
  const relativePath = pathname.replace(/^\/api\/proxy/, '');
  
  const finalUrl = new URL(relativePath, targetUrl);
  searchParams.forEach((value, key) => {
    finalUrl.searchParams.append(key, value);
  });

  const method = req.method;
  const headers = new Headers();
  
  // Forward essential headers
  headers.set('Content-Type', 'application/json');
  headers.set('bypass-tunnel-reminder', 'true');
  
  let body = null;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await req.text();
    } catch (e) {
      // no body
    }
  }

  try {
    const response = await fetch(finalUrl.toString(), {
      method,
      headers,
      body,
      next: { revalidate: 0 } // disable next.js fetch cache
    });

    const contentType = response.headers.get('content-type');
    let responseData;
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
      return NextResponse.json(responseData, { status: response.status });
    } else {
      responseData = await response.text();
      return new NextResponse(responseData, {
        status: response.status,
        headers: { 'Content-Type': contentType || 'text/plain' }
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to proxy request', details: error.message }, { status: 502 });
  }
}

export async function GET(req) { return handleProxy(req); }
export async function POST(req) { return handleProxy(req); }
export async function PUT(req) { return handleProxy(req); }
export async function DELETE(req) { return handleProxy(req); }
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-target-url',
    },
  });
}
