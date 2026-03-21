const { logger } = require('./logger');

/**
 * Required environment variables for the API service.
 * @type {string[]}
 */
const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REDIS_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'INTERNAL_API_SECRET',
];

/**
 * Optional environment variables with defaults.
 * @type {Record<string, string>}
 */
const OPTIONAL_VARS = {
  PORT: '4000',
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  DASHBOARD_URL: 'http://localhost:3000',
  EMAIL_FROM: 'ADA Shield <alerts@adashield.com>',
};

/**
 * Validates that all required environment variables are set at startup.
 * Throws an error if any required variables are missing.
 * Sets defaults for optional variables.
 */
function validateConfig() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  // Set defaults for optional variables
  for (const [key, defaultValue] of Object.entries(OPTIONAL_VARS)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
    }
  }

  logger.info('API configuration validated', {
    env: process.env.NODE_ENV,
    port: process.env.PORT,
  });
}

module.exports = { validateConfig, REQUIRED_VARS };
