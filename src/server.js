import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import accountsRouter from './routes/accounts.routes.js';
import { errorHandler } from './middleware/error-handler.js';

import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Logging
app.use(morgan('dev'));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// CORS
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'https://angular-21-auth-boilerplate-sign-up-kappa.vercel.app'
  ],
  credentials: true
}));

// Swagger Config
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IPT 2026 API',
      version: '1.0.0',
      description: 'Authentication API Documentation'
    },
    servers: [
      {
        url: 'https://ipt-2026-backend-fernandez.vercel.app'
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger Route
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Home Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the IPT-2026 SQLite/Turso Backend API',
    status: 'Healthy',
    database: 'SQLite/Turso (Connected)',
    swagger: '/swagger'
  });
});

// API Routes
app.use('/accounts', accountsRouter);

// Error Handler
app.use(errorHandler);

// Start Server
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;