const { logger } = require('./logger');

/**
 * Required environment variables for the scanner to function.
 * @type {string[]}
 */
const REQUIRED_VARS = ['REDIS_URL'];

/**
 * Optional environment variables with defaults.
 * @type {Record<string, string>}
 */
const OPTIONAL_VARS = {
  LOG_LEVEL: 'info',
  NODE_ENV: 'development',
};

/**
 * Validates that all required environment variables are set.
 * Logs warnings for missing optional vars and uses defaults.
 * Throws if any required vars are missing.
 * @param {string[]} [additionalRequired] - Extra required vars.
 * @throws {Error} If required environment variables are missing.
 */
function validateConfig(additionalRequired = []) {
  const allRequired = [...REQUIRED_VARS, ...additionalRequired];
  const missing = allRequired.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  // Set defaults for optional vars
  for (const [key, defaultValue] of Object.entries(OPTIONAL_VARS)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
    }
  }

  logger.info('Configuration validated', {
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
  });
}

module.exports = { validateConfig, REQUIRED_VARS };
