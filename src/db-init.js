import { execute } from './config/db.js';
import bcrypt from 'bcryptjs';

async function initDatabase() {
  console.log('[Migration] Initializing database schema...');

  // Create accounts table
  await execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      firstName TEXT,
      lastName TEXT,
      email TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT,
      isVerified INTEGER DEFAULT 0,
      verificationToken TEXT,
      verifiedDate TEXT,
      resetToken TEXT,
      resetTokenExpires TEXT,
      passwordResetDate TEXT,
      created TEXT DEFAULT CURRENT_TIMESTAMP,
      updated TEXT
    )
  `);
  console.log('[Migration] Table "accounts" verified.');

  // Create refresh_tokens table
  await execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accountId INTEGER,
      token TEXT UNIQUE,
      expires TEXT,
      created TEXT DEFAULT CURRENT_TIMESTAMP,
      createdByIp TEXT,
      revoked TEXT,
      revokedByIp TEXT,
      replacedByToken TEXT,
      FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);
  console.log('[Migration] Table "refresh_tokens" verified.');

  // Check if admin already exists
  const checkAdmin = await execute('SELECT id FROM accounts WHERE email = ?', ['admin@example.com']);
  
  if (checkAdmin.rows.length === 0) {
    console.log('[Seed] Seeding default administrator account...');
    
    const passwordHash = bcrypt.hashSync('admin', 10);
    const dateCreated = new Date().toISOString();
    
    await execute(`
      INSERT INTO accounts (
        title, firstName, lastName, email, passwordHash, role, isVerified, verifiedDate, created
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'Mr',
      'Admin',
      'User',
      'admin@example.com',
      passwordHash,
      'Admin',
      1, // isVerified = true
      dateCreated,
      dateCreated
    ]);
    
    console.log('[Seed] Default admin account seeded successfully!');
    console.log('  -> Email: admin@example.com');
    console.log('  -> Password: admin');
  } else {
    console.log('[Seed] Administrator account already seeded.');
  }

  console.log('[Migration] Database schema verification completed successfully.');
}

initDatabase().catch(err => {
  console.error('[Migration Error] Database initialization failed:', err);
  process.exit(1);
});
