const { scanPage, scanPageMultiViewport, closeBrowserPool } = require('./scan');
const { calculateRiskScore } = require('./risk-score');
const { createScanWorker, addScanJob } = require('./queue');
const { logger } = require('./utils/logger');

module.exports = {
  scanPage,
  scanPageMultiViewport,
  closeBrowserPool,
  calculateRiskScore,
  createScanWorker,
  addScanJob,
  logger,
};
