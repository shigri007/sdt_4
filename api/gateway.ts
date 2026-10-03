import type { IncomingMessage, ServerResponse } from 'node:http';

type GatewayRequest = IncomingMessage & { query?: Record<string, string | string[]>; body?: unknown };

function json(res: ServerResponse, status: number, error: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ success: false, error }));
}

/** Vercel serves the React files; this function forwards API calls to the persistent Express service. */
export default async function gateway(req: GatewayRequest, res: ServerResponse) {
  const configured = process.env.BACKEND_URL;
  if (!configured) return json(res, 503, 'The application backend is not connected. Set BACKEND_URL in Vercel and redeploy.');

  let backend: URL;
  try {
    backend = new URL(configured);
    if (backend.protocol !== 'https:' && !(backend.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(backend.hostname))) throw new Error('Invalid backend protocol');
  } catch {
    return json(res, 503, 'BACKEND_URL must be an HTTPS backend address.');
  }

  const route = req.query?.path;
  const routePath = Array.isArray(route) ? route.join('/') : route;
  if (!routePath || routePath.split('/').some(part => part === '..' || part === '.' || part.includes('\\'))) return json(res, 404, 'API route not found.');

  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return json(res, 403, 'Request origin is not allowed.');
    } catch { return json(res, 403, 'Request origin is not allowed.'); }
  }

  const target = new URL(`/api/${routePath}`, backend);
  const original = new URL(req.url || '/', 'https://gateway.invalid');
  original.searchParams.delete('path');
  target.search = original.searchParams.toString();

  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'cookie', 'x-csrf-token']) {
    const value = req.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  // The gateway only accepts requests from its own site. Express compares
  // Origin with its host and continues to require the session and CSRF token.
  if (origin) headers.set('origin', backend.origin);

  try {
    let body: string | undefined;
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    }
    const upstream = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    res.statusCode = upstream.status;
    for (const name of ['content-type', 'cache-control', 'location']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res.setHeader('Cache-Control', 'no-store');
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    json(res, 502, 'The application backend is unavailable. Check its service and database status.');
  }
}
