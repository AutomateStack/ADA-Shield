const rateLimit = require('express-rate-limit');

/**
 * Creates a rate limiter middleware with the given options.
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds.
 * @param {number} options.max - Max requests per window per IP.
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again later.`,
    },
  });
}

module.exports = { createRateLimiter };
