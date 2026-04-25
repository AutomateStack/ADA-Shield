const { Queue, Worker } = require('bullmq');
const { getOutreachDigestStats } = require('../db/admin');
const { sendDigestEmail } = require('./email');
const { logger } = require('../utils/logger');

const QUEUE_NAME = 'outreach-digest';

let digestQueue = null;
let digestWorker = null;

function parseRedisUrl(redisUrl) {
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      tls: url.protocol === 'rediss:' ? { rejectUnauthorized: true } : undefined,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

function getDigestQueue() {
  return digestQueue;
}

function initDigestQueue() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || digestQueue) return digestQueue;

  digestQueue = new Queue(QUEUE_NAME, {
    connection: parseRedisUrl(redisUrl),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 20 },
    },
  });

  logger.info('Digest queue initialised');
  return digestQueue;
}

async function scheduleDailyDigest() {
  const queue = getDigestQueue();
  if (!queue) return null;

  const cron = process.env.DIGEST_CRON || '0 8 * * *';

  await queue.upsertJobScheduler(
    'digest-daily-cron',
    { pattern: cron, tz: 'America/New_York' },
    {
      name: 'send-digest',
      data: {},
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
      },
    }
  );

  logger.info('Daily digest scheduled', { cron });
  return { cron };
}

function initDigestWorker() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || digestWorker) return digestWorker;

  digestWorker = new Worker(
    QUEUE_NAME,
    async () => {
      const to = process.env.DIGEST_EMAIL_TO;
      if (!to) {
        logger.warn('DIGEST_EMAIL_TO not set — skipping digest');
        return { status: 'skipped', reason: 'no_recipient' };
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const stats = await getOutreachDigestStats(since);

      const periodLabel = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });

      const result = await sendDigestEmail({ to: [to], stats, periodLabel });
      if (!result) {
        throw new Error('sendDigestEmail returned null — check RESEND_API_KEY');
      }

      logger.info('Daily digest sent', { to, messageId: result.messageId });
      return { status: 'sent', messageId: result.messageId };
    },
    {
      connection: parseRedisUrl(redisUrl),
      concurrency: 1,
    }
  );

  digestWorker.on('failed', (job, err) => {
    logger.error('Digest job failed', { jobId: job?.id, error: err.message });
  });

  digestWorker.on('error', (err) => {
    logger.error('Digest worker error', { error: err.message });
  });

  logger.info('Digest worker initialised');
  return digestWorker;
}

module.exports = {
  initDigestQueue,
  getDigestQueue,
  initDigestWorker,
  scheduleDailyDigest,
};
