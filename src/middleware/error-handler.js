export function errorHandler(err, req, res, next) {
  switch (true) {
    case typeof err === 'string':
      // Custom application error (thrown intentionally by controller/service)
      const is404 = err.toLowerCase().endsWith('not found');
      const statusCode = is404 ? 404 : 400;
      console.warn(`[Application Warn] Status ${statusCode}: ${err}`);
      return res.status(statusCode).json({ message: err });
      
    case err.name === 'UnauthorizedError':
      // JWT authentication error
      console.warn(`[Auth Warn] Unauthorized Access: ${err.message}`);
      return res.status(401).json({ message: 'Unauthorized' });
      
    default:
      // Internal server error or database crash
      console.error('[Server Error]', err);
      return res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}
