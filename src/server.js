import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';

import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import accountsRouter from './routes/accounts.routes.js';
import { errorHandler } from './middleware/error-handler.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// ======================
// MIDDLEWARE
// ======================

app.use(morgan('dev'));

app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));

app.use(cookieParser());

// ======================
// CORS
// ======================

app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://angular-21-auth-boilerplate-sign-up-kappa.vercel.app',
    'https://ipt-2026-frontend.onrender.com'
  ],
  credentials: true
}));

// ======================
// SWAGGER CONFIG
// ======================

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Node.js Sign-up and Verification API',
      version: '1.0.0',
      description: 'Authentication API using Express, SQLite/Turso, JWT, Refresh Tokens and Email Verification'
    },
    servers: [
      {
        url: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : `http://localhost:${port}`
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ======================
// ROOT ROUTE
// ======================

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the IPT-2026 SQLite/Turso Backend API',
    status: 'Healthy',
    swagger: '/api-docs'
  });
});

// ======================
// ROUTES
// ======================

app.use('/accounts', accountsRouter);

// ======================
// ERROR HANDLER
// ======================

app.use(errorHandler);

// ======================
// START SERVER
// ======================

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

export default app;