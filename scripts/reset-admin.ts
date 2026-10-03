import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../server/src/db/index.js';

async function main() {
  await db.init();
  const admin = db.store.users.find(user => user.username === 'admin' && user.role_code === 'ADMINISTRATOR');
  if (!admin) throw new Error('The initial administrator account was not found.');
  const password = randomBytes(24).toString('base64url');
  admin.password_hash = await bcrypt.hash(password, 12);
  admin.updated_at = new Date().toISOString();
  admin.is_active = 1;
  db.persist();
  db.deleteSessionsForUser(admin.id);
  db.close();
  console.log('Administrator username: admin');
  console.log('New administrator password:', password);
  console.log('Save this password now; it cannot be displayed again.');
}

main().catch(error => {
  db.close();
  console.error('Could not reset administrator access:', error);
  process.exitCode = 1;
});
