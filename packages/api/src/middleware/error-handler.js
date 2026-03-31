const { logger } = require('../utils/logger');

/**
 * Global Express error handler.
 * Catches all unhandled errors and returns a consistent JSON response.
 * Never exposes internal error details in production.
 */
function errorHandler(err, req, res, _next) {
  const requestId = req.requestId || 'unknown';

  logger.error('Unhandled error', {
    requestId,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    error: message,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
