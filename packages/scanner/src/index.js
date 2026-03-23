const { scanPage } = require('./scan');
const { calculateRiskScore } = require('./risk-score');
const { createScanWorker, addScanJob } = require('./queue');
const { logger } = require('./utils/logger');

module.exports = {
  scanPage,
  calculateRiskScore,
  createScanWorker,
  addScanJob,
  logger,
};
