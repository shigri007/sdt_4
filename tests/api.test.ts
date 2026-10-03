import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import apiRouter from '../server/src/routes/api.js';
import { db } from '../server/src/db/index.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);
const agent = request.agent(app);
let csrfToken = '';

beforeAll(async () => {
  process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(),'steritrack-test-')),'app.sqlite');
  process.env.INITIAL_PASSWORD = 'TestPassword!4857';
  await db.init();
  for (const [username,password] of [['lin_xia','Department!4857'],['chen_wei','Operator!4857'],['zhang_lei','Quality!4857']]) {
    const user = db.store.users.find(u => u.username === username)!;
    user.password_hash = bcrypt.hashSync(password, 10);
  }
  db.persist();
});
afterAll(() => db.close());

describe('API access and persistence', () => {
  it('reports a ready local database without claiming unverified safety outcomes', async () => {
    const response = await agent.get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.database).toContain('SQLite');
    expect(response.body).not.toHaveProperty('invariants');
  });

  it('requires an authenticated session', async () => {
    expect((await request(app).get('/api/kits')).status).toBe(401);
    expect((await request(app).post('/api/auth/demo-switch').send({username:'admin'})).status).toBe(404);
  });

  it('rejects wrong credentials and signs in with a protected cookie', async () => {
    expect((await agent.post('/api/auth/login').send({username:'admin',password:'wrong'})).status).toBe(401);
    const response = await agent.post('/api/auth/login').send({username:'admin',password:'TestPassword!4857'});
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('ADMINISTRATOR');
    expect(response.body).not.toHaveProperty('token');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    csrfToken = response.body.csrfToken;
  });

  it('reads records and blocks mutations without CSRF proof', async () => {
    expect((await agent.get('/api/users')).status).toBe(200);
    expect((await agent.post('/api/kits').send({kitCode:'KIT-TEST',kitName:'Test',kitTypeId:1})).status).toBe(403);
    expect((await agent.get('/api/kits/KIT-0012/trace')).status).toBe(403);
  });

  it('allows only an administrator to create staff accounts', async () => {
    const department = request.agent(app);
    const signedIn = await department.post('/api/auth/login').send({username:'lin_xia',password:'Department!4857'});
    expect(signedIn.status).toBe(200);
    const account = {username:'new_staff',email:'new.staff@example.org',fullName:'New Staff Member',role:'DEPARTMENT_STAFF',departmentId:1,password:'UniquePassword!4857'};
    expect((await department.post('/api/users').set('X-CSRF-Token',signedIn.body.csrfToken).send(account)).status).toBe(403);
    const created = await agent.post('/api/users').set('X-CSRF-Token',csrfToken).send(account);
    expect(created.status).toBe(201);
    expect((await request(app).post('/api/auth/login').send({username:account.username,password:account.password})).status).toBe(200);
  });

  it('keeps an accepted record after reopening the SQLite file', async () => {
    const coordinator = request.agent(app);
    const signedIn = await coordinator.post('/api/auth/login').send({username:'zhang_lei',password:'Quality!4857'});
    const created = await coordinator.post('/api/kits').set('X-CSRF-Token',signedIn.body.csrfToken).send({kitCode:'KIT-TEST',kitName:'Test Kit',kitTypeId:1,departmentOwnerId:1});
    expect(created.status).toBe(201);
    db.persist();
    db.close();
    await db.init();
    expect(db.store.kits.some(kit => kit.kit_code === 'KIT-TEST')).toBe(true);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
  });

  it('enforces distinct permissions for all four roles at the HTTP boundary', async () => {
    const roles = [
      {username:'admin',password:'TestPassword!4857',allow:'/api/users',deny:'/api/qc/pending',denyMutation:'/api/qc/1/review'},
      {username:'lin_xia',password:'Department!4857',allow:'/api/requests',deny:'/api/users',denyMutation:'/api/batches'},
      {username:'chen_wei',password:'Operator!4857',allow:'/api/processing/queues',deny:'/api/qc/pending',denyMutation:'/api/users'},
      {username:'zhang_lei',password:'Quality!4857',allow:'/api/qc/pending',deny:'/api/users',denyMutation:'/api/batches'},
    ];
    for (const role of roles) {
      const client = request.agent(app);
      const signedIn = await client.post('/api/auth/login').send({username:role.username,password:role.password});
      expect(signedIn.status).toBe(200);
      expect((await client.get(role.allow)).status).toBe(200);
      expect((await client.get(role.deny)).status).toBe(403);
      expect((await client.post(role.denyMutation).set('X-CSRF-Token',signedIn.body.csrfToken).send({})).status).toBe(403);
    }
    expect((await agent.post('/api/kits').set('X-CSRF-Token',csrfToken).send({kitCode:'NO-ADMIN',kitName:'No Admin',kitTypeId:1,departmentOwnerId:1})).status).toBe(403);
  });
});
