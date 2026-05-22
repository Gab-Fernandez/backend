import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import https from 'https';
import errorHandler from './_middleware/error-handler';
import accountsController from './accounts/accounts.controller';
import swaggerDocs from './_helpers/swagger';

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://ipt-2026-frontend-sjr8.onrender.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/accounts', accountsController);

app.use('/api-docs', swaggerDocs);

app.use(errorHandler);

const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
app.listen(port, () => console.log('Server listening on port ' + port));

// Keep Render free tier alive
setInterval(() => {
  https.get('https://ipt-2026-backend-5ihl.onrender.com/accounts', (res) => {
    res.resume(); // drain the response so the socket closes cleanly
  }).on('error', () => {
    // silently ignore — backend may be mid-spin-up
  });
}, 14 * 60 * 1000);