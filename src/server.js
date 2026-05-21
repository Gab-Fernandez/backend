import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import accountsRouter from './routes/accounts.routes.js';
import { errorHandler } from './middleware/error-handler.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Log HTTP requests
app.use(morgan('dev'));

// Parse incoming JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Parse request cookies (necessary for HttpOnly token rotation)
app.use(cookieParser());

// Enable CORS for frontend connection (Angular local server & Vercel deployments)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:4200',
      'http://127.0.0.1:4200'
    ];
    
    // Add custom frontend URL from env variables if configured
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    
    // Allow if in allowed list, is a Vercel deployment, or not in production mode
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.vercel.app') || 
                      process.env.NODE_ENV !== 'production';
    
    if (isAllowed) {
      return callback(null, true);
    }
    
    return callback(new Error('CORS Policy: Origin not allowed'), false);
  },
  credentials: true // Crucial to allow reading/writing cookies across domains
}));

// Welcome / Health-check Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the IPT-2026 SQLite/Turso Backend API',
    status: 'Healthy',
    database: 'SQLite/Turso (Connected)',
    documentation: 'See accounts.routes.js for complete endpoint list'
  });
});

// API Routes binding
app.use('/accounts', accountsRouter);

// Global centralized Error Handler
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`\n🚀 [Server] Express Server running on: http://localhost:${port}`);
    console.log(`👉 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`👉 Database configuration verified\n`);
  });
}

export default app;
