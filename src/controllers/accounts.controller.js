import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { execute } from '../config/db.js';
import { sendEmail } from '../services/email.service.js';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_change_me_in_prod';

// Helper: Basic Details mapper
function basicDetails(account) {
  const { id, title, firstName, lastName, email, role, created, isVerified } = account;
  return { 
    id, 
    title, 
    firstName, 
    lastName, 
    email, 
    role, 
    dateCreated: created, 
    isVerified: !!isVerified 
  };
}

// Helper: Generate JWT Token
function generateJwtToken(account) {
  return jwt.sign({ id: account.id }, jwtSecret, { expiresIn: '15m' });
}

// Helper: Generate Refresh Token in DB & set HttpOnly cookie
async function generateRefreshToken(account, ipAddress) {
  const token = crypto.randomBytes(40).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // Insert refresh token in database
  await execute(`
    INSERT INTO refresh_tokens (accountId, token, expires, createdByIp)
    VALUES (?, ?, ?, ?)
  `, [account.id, token, expires, ipAddress]);

  return { token, expires };
}

// Helper: Set Cookie in Response
function setTokenCookie(res, tokenValue, expiresDate) {
  const options = {
    httpOnly: true,
    expires: new Date(expiresDate),
    path: '/',
    // Enable secure in production
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  // Support both typical cookie names to ensure seamless compatibility with client boilerplates
  res.cookie('fakeRefreshToken', tokenValue, options);
  res.cookie('refreshToken', tokenValue, options);
}

// Helper: Get Refresh Token from Request cookies
function getRefreshTokenFromRequest(req) {
  return req.cookies.fakeRefreshToken || req.cookies.refreshToken;
}

// --- Controller Methods ---

export async function authenticate(req, res, next) {
  try {
    const { email, password } = req.body;
    
    // Find account
    const accountQuery = await execute('SELECT * FROM accounts WHERE email = ?', [email]);
    if (accountQuery.rows.length === 0) {
      throw 'Email or password is incorrect';
    }

    const account = accountQuery.rows[0];

    // Verify password
    const isPasswordValid = bcrypt.compareSync(password, account.passwordHash);
    if (!isPasswordValid) {
      throw 'Email or password is incorrect';
    }

    // Verify email verification status
// if (!account.isVerified) {
//   throw 'Email is not verified. Please check your verification link.';
// }
    // Generate tokens
    const jwtToken = generateJwtToken(account);
    const refreshToken = await generateRefreshToken(account, req.ip);

    // Set refresh token cookies
    setTokenCookie(res, refreshToken.token, refreshToken.expires);

    // Return response
    res.json({
      ...basicDetails(account),
      jwtToken
    });
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  try {
    const params = req.body;

    // Check if email already registered
    const emailQuery = await execute('SELECT id FROM accounts WHERE email = ?', [params.email]);
    if (emailQuery.rows.length > 0) {
      // Return 200 OK to prevent email enumeration, but log the event
      console.log(`[Register] Prevented email duplicate registration check for: ${params.email}`);
      return res.json({ message: 'Registration successful, please check your email for verification instructions' });
    }

    // Determine role (first account is Admin, others are User)
    const countQuery = await execute('SELECT COUNT(id) AS count FROM accounts');
    const role = countQuery.rows[0].count === 0 ? 'Admin' : 'User';

    // Hash password
    const passwordHash = bcrypt.hashSync(params.password, 10);
    const verificationToken = crypto.randomBytes(40).toString('hex');
    const createdDate = new Date().toISOString();

    // Insert new account
    await execute(`
      INSERT INTO accounts (
        title, firstName, lastName, email, passwordHash, role, isVerified, verificationToken, created
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      params.title,
      params.firstName,
      params.lastName,
      params.email,
      passwordHash,
      role,
      verificationToken,
      createdDate
    ]);

    // Dispatched verification email with active link
    const verifyUrl = `${req.headers.origin || 'http://localhost:4200'}/account/verify-email?token=${verificationToken}`;
    
    await sendEmail({
      to: params.email,
      subject: 'Verify Your Email - Sign-up Successful',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4a90e2; text-align: center;">Welcome to IPT Authentication!</h2>
          <p>Dear ${params.title || ''} ${params.firstName} ${params.lastName},</p>
          <p>Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #4a90e2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
          <p style="word-break: break-all; color: #888;">${verifyUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">If you did not sign up for this account, you can safely ignore this email.</p>
        </div>
      `
    });

    res.json({ 
      message: 'Registration successful, please check your email for verification instructions',
      developmentVerifyUrl: verifyUrl
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;

    const accountQuery = await execute('SELECT * FROM accounts WHERE verificationToken = ?', [token]);
    if (accountQuery.rows.length === 0) {
      throw 'Verification failed: Invalid token';
    }

    const account = accountQuery.rows[0];
    const verifiedDate = new Date().toISOString();

    // Update verified fields
    await execute(`
      UPDATE accounts 
      SET isVerified = 1, verificationToken = NULL, verifiedDate = ?, updated = ?
      WHERE id = ?
    `, [verifiedDate, verifiedDate, account.id]);

    res.json({ message: 'Verification successful, you can now login' });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const token = getRefreshTokenFromRequest(req);
    if (!token) {
      throw 'Invalid token';
    }

    // Retrieve active refresh token
    const tokenQuery = await execute('SELECT * FROM refresh_tokens WHERE token = ? AND revoked IS NULL', [token]);
    if (tokenQuery.rows.length === 0) {
      throw 'Invalid token';
    }

    const refreshTokenRow = tokenQuery.rows[0];
    
    // Retrieve parent account
    const accountQuery = await execute('SELECT * FROM accounts WHERE id = ?', [refreshTokenRow.accountId]);
    if (accountQuery.rows.length === 0) {
      throw 'Invalid token';
    }

    const account = accountQuery.rows[0];

    // Check expiration
    if (new Date() > new Date(refreshTokenRow.expires)) {
      throw 'Expired refresh token';
    }

    // Revoke old token and rotate new one
    const newRefreshToken = await generateRefreshToken(account, req.ip);
    const revokedDate = new Date().toISOString();

    await execute(`
      UPDATE refresh_tokens 
      SET revoked = ?, revokedByIp = ?, replacedByToken = ?
      WHERE id = ?
    `, [revokedDate, req.ip, newRefreshToken.token, refreshTokenRow.id]);

    // Set new cookies
    setTokenCookie(res, newRefreshToken.token, newRefreshToken.expires);

    // Return new JWT
    const jwtToken = generateJwtToken(account);
    res.json({
      ...basicDetails(account),
      jwtToken
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeToken(req, res, next) {
  try {
    // Revoke token from body or cookie
    const token = req.body.token || getRefreshTokenFromRequest(req);
    if (!token) {
      throw 'Token is required';
    }

    // Verify token exists
    const tokenQuery = await execute('SELECT * FROM refresh_tokens WHERE token = ? AND revoked IS NULL', [token]);
    if (tokenQuery.rows.length > 0) {
      const refreshTokenRow = tokenQuery.rows[0];
      const revokedDate = new Date().toISOString();

      // Revoke in DB
      await execute(`
        UPDATE refresh_tokens
        SET revoked = ?, revokedByIp = ?
        WHERE id = ?
      `, [revokedDate, req.ip, refreshTokenRow.id]);
    }

    // Clear client-side cookies
    res.clearCookie('fakeRefreshToken');
    res.clearCookie('refreshToken');

    res.json({ message: 'Token revoked successfully' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const accountQuery = await execute('SELECT * FROM accounts WHERE email = ?', [email]);
    if (accountQuery.rows.length === 0) {
      // Prevents email enumeration, returns success
      return res.json({ message: 'Please check your email for password reset instructions' });
    }

    const account = accountQuery.rows[0];
    const resetToken = crypto.randomBytes(40).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    const updatedDate = new Date().toISOString();

    // Save tokens to DB
    await execute(`
      UPDATE accounts 
      SET resetToken = ?, resetTokenExpires = ?, updated = ?
      WHERE id = ?
    `, [resetToken, resetTokenExpires, updatedDate, account.id]);

    // Dispatched password reset email with active link
    const resetUrl = `${req.headers.origin || 'http://localhost:4200'}/account/reset-password?token=${resetToken}`;
    
    await sendEmail({
      to: email,
      subject: 'Reset Password Request',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #d0021b; text-align: center;">Reset Your Password</h2>
          <p>Dear ${account.title || ''} ${account.firstName} ${account.lastName},</p>
          <p>We received a request to reset your password. Please click the button below to set a new password. This link is valid for 24 hours:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #d0021b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
          <p style="word-break: break-all; color: #888;">${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        </div>
      `
    });

    res.json({ 
      message: 'Please check your email for password reset instructions',
      developmentResetUrl: resetUrl
    });
  } catch (err) {
    next(err);
  }
}

export async function validateResetToken(req, res, next) {
  try {
    const { token } = req.body;

    const accountQuery = await execute(`
      SELECT * FROM accounts 
      WHERE resetToken = ? AND resetTokenExpires > ?
    `, [token, new Date().toISOString()]);

    if (accountQuery.rows.length === 0) {
      throw 'Invalid token';
    }

    res.json({ message: 'Token is valid' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    // Verify token validity
    const accountQuery = await execute(`
      SELECT * FROM accounts 
      WHERE resetToken = ? AND resetTokenExpires > ?
    `, [token, new Date().toISOString()]);

    if (accountQuery.rows.length === 0) {
      throw 'Invalid token';
    }

    const account = accountQuery.rows[0];
    const passwordHash = bcrypt.hashSync(password, 10);
    const updatedDate = new Date().toISOString();

    // Save new password and remove token fields
    await execute(`
      UPDATE accounts 
      SET passwordHash = ?, resetToken = NULL, resetTokenExpires = NULL, passwordResetDate = ?, updated = ?
      WHERE id = ?
    `, [passwordHash, updatedDate, updatedDate, account.id]);

    res.json({ message: 'Password reset successful, you can now login' });
  } catch (err) {
    next(err);
  }
}

// --- Admin-Only / Authorized CRUD endpoints ---

export async function getAll(req, res, next) {
  try {
    const accountsQuery = await execute('SELECT * FROM accounts');
    const result = accountsQuery.rows.map(x => basicDetails(x));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const { id } = req.params;

    // Authorize: Admin or Self
    if (parseInt(id) !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const accountQuery = await execute('SELECT * FROM accounts WHERE id = ?', [id]);
    if (accountQuery.rows.length === 0) {
      throw 'Account not found';
    }

    res.json(basicDetails(accountQuery.rows[0]));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const params = req.body;

    // Check email
    const emailQuery = await execute('SELECT id FROM accounts WHERE email = ?', [params.email]);
    if (emailQuery.rows.length > 0) {
      throw `Email "${params.email}" is already registered`;
    }

    const passwordHash = bcrypt.hashSync(params.password, 10);
    const createdDate = new Date().toISOString();

    // Create verified account
    await execute(`
      INSERT INTO accounts (
        title, firstName, lastName, email, passwordHash, role, isVerified, verifiedDate, created
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      params.title,
      params.firstName,
      params.lastName,
      params.email,
      passwordHash,
      params.role,
      createdDate,
      createdDate
    ]);

    res.json({ message: 'Account created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const params = req.body;

    // Authorize: Admin or Self
    if (parseInt(id) !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Retrieve original account record
    const accountQuery = await execute('SELECT * FROM accounts WHERE id = ?', [id]);
    if (accountQuery.rows.length === 0) {
      throw 'Account not found';
    }

    const account = accountQuery.rows[0];

    // Check unique email if changing email
    if (params.email && params.email !== account.email) {
      const emailQuery = await execute('SELECT id FROM accounts WHERE email = ?', [params.email]);
      if (emailQuery.rows.length > 0) {
        throw `Email "${params.email}" is already in use`;
      }
    }

    // Prepare fields
    const title = params.title || account.title;
    const firstName = params.firstName || account.firstName;
    const lastName = params.lastName || account.lastName;
    const email = params.email || account.email;
    const role = (req.user.role === 'Admin' && params.role) ? params.role : account.role;
    
    // Hash password if modifying password
    let passwordHash = account.passwordHash;
    if (params.password) {
      passwordHash = bcrypt.hashSync(params.password, 10);
    }

    const updatedDate = new Date().toISOString();

    // Update in DB
    await execute(`
      UPDATE accounts
      SET title = ?, firstName = ?, lastName = ?, email = ?, passwordHash = ?, role = ?, updated = ?
      WHERE id = ?
    `, [title, firstName, lastName, email, passwordHash, role, updatedDate, id]);

    // Return the updated details
    const updatedQuery = await execute('SELECT * FROM accounts WHERE id = ?', [id]);
    res.json(basicDetails(updatedQuery.rows[0]));
  } catch (err) {
    next(err);
  }
}

export async function _delete(req, res, next) {
  try {
    const { id } = req.params;

    // Authorize: Admin or Self
    if (parseInt(id) !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Delete in DB
    await execute('DELETE FROM accounts WHERE id = ?', [id]);

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
}
