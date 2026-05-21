import express from 'express';
import { authorize } from '../middleware/auth.js';
import * as accountsController from '../controllers/accounts.controller.js';

const router = express.Router();

// Public routes
router.post('/authenticate', accountsController.authenticate);
router.post('/register', accountsController.register);
router.post('/verify-email', accountsController.verifyEmail);
router.post('/forgot-password', accountsController.forgotPassword);
router.post('/validate-reset-token', accountsController.validateResetToken);
router.post('/reset-password', accountsController.resetPassword);
router.post('/refresh-token', accountsController.refreshToken);
router.post('/revoke-token', accountsController.revokeToken);

// Protected routes (Any authenticated user)
router.get('/:id', authorize(), accountsController.getById);
router.put('/:id', authorize(), accountsController.update);
router.delete('/:id', authorize(), accountsController._delete);

// Admin-only routes
router.get('/', authorize('Admin'), accountsController.getAll);
router.post('/', authorize('Admin'), accountsController.create);

export default router;
