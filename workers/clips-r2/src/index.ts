export interface Env {
  CLIPS: R2Bucket;
  CLIPS_UPLOAD_SECRET?: string;
}

function cors(headers: HeadersInit = {}): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-clips-secret, Range',
    ...headers,
  };
}

function authorized(req: Request, env: Env): boolean {
  const expected = env.CLIPS_UPLOAD_SECRET;
  if (!expected) return false;
  const header =
    req.headers.get('x-clips-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  return header === expected;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }

    const url = new URL(req.url);

    // Read: GET|HEAD /object?key=clips/...
    // Public GET for highlight pages; HEAD may use secret for existence checks
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/object') {
      const key = url.searchParams.get('key') || '';
      if (!key.startsWith('clips/') && !key.startsWith('prospects/')) {
        return Response.json({ error: 'Invalid key' }, { status: 400, headers: cors() });
      }
      if (req.method === 'HEAD') {
        const obj = await env.CLIPS.head(key);
        if (!obj) {
          return new Response(null, { status: 404, headers: cors() });
        }
        const headers = new Headers(cors());
        headers.set('etag', obj.httpEtag);
        headers.set('Content-Length', String(obj.size));
        if (obj.httpMetadata?.contentType) {
          headers.set('Content-Type', obj.httpMetadata.contentType);
        }
        return new Response(null, { status: 200, headers });
      }
      const obj = await env.CLIPS.get(key);
      if (!obj) {
        return Response.json({ error: 'Not found' }, { status: 404, headers: cors() });
      }
      const headers = new Headers(cors());
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      headers.set('Cache-Control', 'public, max-age=3600');
      return new Response(obj.body, { headers });
    }

    // Authenticated upload: PUT /upload?key=clips/...
    if (req.method === 'PUT' && url.pathname === '/upload') {
      if (!authorized(req, env)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors() });
      }
      const key = url.searchParams.get('key') || '';
      if ((!key.startsWith('clips/') && !key.startsWith('prospects/')) || key.includes('..')) {
        return Response.json({ error: 'Invalid key' }, { status: 400, headers: cors() });
      }
      const contentType = req.headers.get('content-type') || 'application/octet-stream';
      const body = await req.arrayBuffer();
      if (body.byteLength > 25 * 1024 * 1024) {
        return Response.json({ error: 'File too large (25MB max)' }, { status: 413, headers: cors() });
      }
      await env.CLIPS.put(key, body, {
        httpMetadata: { contentType },
      });
      return Response.json(
        { ok: true, key, publicUrl: `/object?key=${encodeURIComponent(key)}` },
        { headers: cors() }
      );
    }

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'coldcallreps-clips-r2' }, { headers: cors() });
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: cors() });
  },
};
