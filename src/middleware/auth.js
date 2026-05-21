import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { execute } from '../config/db.js';

dotenv.config();

const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_change_me_in_prod';

/**
 * Authorization wrapper supporting role restrictions.
 * Usage: authorize([Role.Admin, Role.User]) or authorize(Role.Admin) or authorize() for any authenticated user.
 */
export function authorize(roles = []) {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return [
    // Authenticate JWT token and attach user to request
    async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ message: 'Unauthorized: Missing or invalid token format' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        
        try {
          decoded = jwt.verify(token, secret);
        } catch (jwtErr) {
          return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
        }

        // Retrieve full account details from database
        const accountQuery = await execute('SELECT * FROM accounts WHERE id = ?', [decoded.id]);
        if (accountQuery.rows.length === 0) {
          return res.status(401).json({ message: 'Unauthorized: Account not found' });
        }

        const account = accountQuery.rows[0];
        
        // Attach user object to request
        req.user = {
          id: account.id,
          email: account.email,
          role: account.role,
        };

        // Verification of refresh token rotations
        const refreshTokensQuery = await execute(
          'SELECT token FROM refresh_tokens WHERE accountId = ? AND revoked IS NULL', 
          [account.id]
        );
        req.user.ownsToken = (token) => !!refreshTokensQuery.rows.find(x => x.token === token);

        next();
      } catch (err) {
        next(err);
      }
    },

    // Authorize user based on roles
    (req, res, next) => {
      if (roles.length && !roles.includes(req.user.role)) {
        // User's role is not authorized
        return res.status(403).json({ message: 'Forbidden: Access denied' });
      }

      // Authentication and authorization successful
      next();
    }
  ];
}
