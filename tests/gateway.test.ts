import { afterAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import request from 'supertest';
import gateway from '../api/gateway.js';

const servers: Server[] = [];
const previousBackend = process.env.BACKEND_URL;

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test address');
  return `http://127.0.0.1:${address.port}`;
}

afterAll(async () => {
  if (previousBackend === undefined) delete process.env.BACKEND_URL;
  else process.env.BACKEND_URL = previousBackend;
  await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe('Vercel API gateway', () => {
  it('explains missing backend configuration as JSON', async () => {
    delete process.env.BACKEND_URL;
    const frontend = createServer((req, res) => {
      (req as typeof req & {query: Record<string,string>}).query = { path: 'health' };
      void gateway(req, res);
    });
    const url = await listen(frontend);
    const response = await request(url).get('/api/gateway?path=health');
    expect(response.status).toBe(503);
    expect(response.body.error).toContain('BACKEND_URL');
  });

  it('forwards login, same-origin proof and session cookie to a persistent API', async () => {
    const backend = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Set-Cookie', 'steritrack_session=test; HttpOnly; SameSite=Lax; Path=/api');
      res.end(JSON.stringify({path:req.url, origin:req.headers.origin, credentials:JSON.parse(Buffer.concat(chunks).toString())}));
    });
    process.env.BACKEND_URL = await listen(backend);
    const frontend = createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://frontend.test');
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      (req as typeof req & {query: Record<string,string>;body:unknown}).query = { path: url.searchParams.get('path') || '' };
      (req as typeof req & {body:unknown}).body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      await gateway(req, res);
    });
    const url = await listen(frontend);
    const response = await request(url).post('/api/gateway?path=auth/login').set('Origin',url).send({username:'admin',password:'private'});
    expect(response.status).toBe(200);
    expect(response.body.path).toBe('/api/auth/login');
    expect(response.body.origin).toBe(process.env.BACKEND_URL);
    expect(response.body.credentials.username).toBe('admin');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });
});
