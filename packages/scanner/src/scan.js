const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { logger } = require('./utils/logger');
const { generateFix } = require('./fix-suggester');

// ── Browser Pool ────────────────────────────────────────────────────
// Reuses browser instances to avoid ~8s launch overhead per scan.
// Automatically recycles after MAX_PAGES_PER_BROWSER to prevent memory leaks.
const MAX_PAGES_PER_BROWSER = 20;
const BROWSER_POOL_ENABLED = process.env.SCANNER_BROWSER_POOL !== 'false';
let _browserInstance = null;
let _browserPageCount = 0;
let _browserLock = Promise.resolve();

/**
 * Gets or creates a shared browser instance.
 * Thread-safe via promise chain lock.
 */
async function getBrowser() {
  if (!BROWSER_POOL_ENABLED) {
    throw new Error('Browser pool disabled by SCANNER_BROWSER_POOL=false');
  }

  _browserLock = _browserLock.then(async () => {
    if (_browserInstance && _browserInstance.isConnected() && _browserPageCount < MAX_PAGES_PER_BROWSER) {
      _browserPageCount++;
      return;
    }
    // Close stale browser if exists
    if (_browserInstance) {
      try { await _browserInstance.close(); } catch { /* ignore */ }
      _browserInstance = null;
    }
    const executablePath = getChromePath();
    logger.info('Launching Chrome (pooled)', { executablePath: executablePath || 'puppeteer default' });
    _browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: BROWSER_ARGS,
      timeout: 30000,
    });
    _browserPageCount = 1;
  });
  await _browserLock;
  return _browserInstance;
}

/**
 * Gracefully shuts down the browser pool.
 * Call on process exit / SIGTERM.
 */
async function closeBrowserPool() {
  if (_browserInstance) {
    try { await _browserInstance.close(); } catch { /* ignore */ }
    _browserInstance = null;
    _browserPageCount = 0;
    logger.info('Browser pool closed');
  }
}

// Resolve Chrome executable path by searching known cache locations.
// This handles cases where PUPPETEER_CACHE_DIR env var is set at build time
// but not at runtime (e.g. Render free tier with render.yaml env vars not
// auto-applied to existing services).
function getChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Search these cache dirs in order of preference
  const cacheDirs = [
    process.env.PUPPETEER_CACHE_DIR,
    '/opt/render/project/src/.cache/puppeteer', // Render: project-internal install
    path.join(os.homedir(), '.cache', 'puppeteer'), // default Linux/Mac
  ].filter(Boolean);

  for (const cacheDir of cacheDirs) {
    const chromeCacheDir = path.join(cacheDir, 'chrome');
    if (!fs.existsSync(chromeCacheDir)) continue;
    try {
      const versions = fs.readdirSync(chromeCacheDir);
      for (const version of versions) {
        const chromeBin = path.join(chromeCacheDir, version, 'chrome-linux64', 'chrome');
        if (fs.existsSync(chromeBin)) return chromeBin;
      }
    } catch (e) { /* keep searching */ }
  }

  try {
    return puppeteer.executablePath();
  } catch (err) {
    logger.warn('Could not resolve Chrome executable path', { error: err.message });
    return undefined;
  }
}

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--no-zygote',
  '--memory-pressure-off',
];

/**
 * Default page navigation options
 * @type {import('puppeteer').GoToOptions}
 */
const DEFAULT_NAV_OPTIONS = {
  waitUntil: 'networkidle2',
  timeout: 30000,
};

/**
 * Detects whether an error is a Puppeteer navigation timeout.
 * @param {unknown} error
 * @returns {boolean}
 */
function isNavigationTimeoutError(error) {
  const message = error?.message || '';
  return (
    typeof message === 'string' &&
    message.toLowerCase().includes('navigation timeout')
  );
}

/**
 * Navigates with retries and fallback wait strategies for slow websites.
 * @param {import('puppeteer').Page} page
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<{waitUntil: "load"|"domcontentloaded", timeout: number}>}
 */
async function navigateWithRetry(page, url, timeoutMs) {
  const attempts = [
    { waitUntil: 'load', timeout: timeoutMs },
    { waitUntil: 'load', timeout: Math.max(timeoutMs + 15000, 45000) },
    { waitUntil: 'domcontentloaded', timeout: Math.max(timeoutMs + 15000, 45000) },
  ];

  let lastError;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      await page.goto(url, attempt);
      return attempt;
    } catch (error) {
      lastError = error;
      const isTimeout = isNavigationTimeoutError(error);
      const isLastAttempt = i === attempts.length - 1;

      logger.warn('Navigation attempt failed', {
        url,
        attempt: i + 1,
        waitUntil: attempt.waitUntil,
        timeout: attempt.timeout,
        isTimeout,
        error: error.message,
      });

      // Only retry navigation timeouts; bubble up other failures immediately.
      if (!isTimeout || isLastAttempt) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Extracts site contact metadata from page HTML.
 * Looks for common patterns: company name, contact email, sitemap, etc.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<object>} Metadata with owner/sales contact hints
 */
async function extractPageMetadata(page) {
  try {
    const metadata = await page.evaluate(() => {
      const result = {
        title: document.title || null,
        companyName: null,
        contactEmail: null,
        supportEmail: null,
        footerText: null,
        allEmails: [],
      };

      const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

      // Try to extract company name from common metadata tags.
      const ogNameMeta = document.querySelector('meta[property="og:site_name"]');
      const appNameMeta = document.querySelector('meta[name="application-name"]');
      if (ogNameMeta?.getAttribute('content')) {
        result.companyName = ogNameMeta.getAttribute('content');
      } else if (appNameMeta?.getAttribute('content')) {
        result.companyName = appNameMeta.getAttribute('content');
      }

      const emailSet = new Set();

      // 1) Collect explicit mailto links first (usually highest quality).
      document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const candidate = href.replace(/^mailto:/i, '').split('?')[0].trim();
        if (candidate) emailSet.add(candidate.toLowerCase());
      });

      // 2) Collect from footer text.
      const footer = document.querySelector('footer');
      if (footer) {
        const footerText = footer.innerText || '';
        result.footerText = footerText.substring(0, 300);
        const footerMatches = footerText.match(EMAIL_REGEX) || [];
        footerMatches.forEach((e) => emailSet.add(e.toLowerCase()));
      }

      // 3) Collect from full page text as a fallback.
      const bodyText = document.body?.innerText || '';
      const bodyMatches = bodyText.match(EMAIL_REGEX) || [];
      bodyMatches.forEach((e) => emailSet.add(e.toLowerCase()));

      // Basic cleanup of false positives / noisy emails.
      const blocked = new Set(['example.com', 'domain.com', 'email.com']);
      const allEmails = Array.from(emailSet)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'))
        .filter((e) => {
          const domain = e.split('@')[1] || '';
          return domain && !blocked.has(domain);
        });

      result.allEmails = allEmails;
      if (allEmails.length > 0) {
        result.contactEmail = allEmails[0];
      }
      if (allEmails.length > 1) {
        result.supportEmail = allEmails[1];
      }

      // Fallback: search entire page for company name in h1.
      const h1 = document.querySelector('h1');
      if (h1 && !result.companyName) {
        result.companyName = (h1.innerText || '').trim() || null;
      }

      return result;
    });

    return metadata;
  } catch (err) {
    logger.warn('Failed to extract page metadata', { error: err.message });
    return {};
  }
}

/**
 * Scans a single page for WCAG 2.1 AA accessibility violations using axe-core.
 * @param {string} url - The URL to scan.
 * @param {object} [options] - Optional configuration.
 * @param {number} [options.timeout=30000] - Navigation timeout in ms.
 * @returns {Promise<object>} The axe-core analysis results with violation counts.
 */
async function scanPage(url, options = {}) {
  const startTime = Date.now();
  let page = null;
  let browser = null;
  let usedPool = false;

  try {
    logger.info('Starting scan', { url });

    try {
      // Try pooled browser first (faster)
      browser = await getBrowser();
      usedPool = true;
    } catch (poolErr) {
      // Fallback to standalone browser if pool fails
      logger.warn('Browser pool failed, launching standalone', { error: poolErr.message });
      const executablePath = getChromePath();
      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: BROWSER_ARGS,
        timeout: 30000,
      });
    }

    page = await browser.newPage();

    // Set viewport — customizable for mobile scanning
    const viewport = options.viewport || { width: 1280, height: 1024 };
    await page.setViewport(viewport);
    await page.setUserAgent(
      options.userAgent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Allow axe-core injection even on pages with strict CSP
    await page.setBypassCSP(true);

    // Navigate with fallback strategies to reduce flaky timeout failures.
    const navTimeout = options.timeout || DEFAULT_NAV_OPTIONS.timeout;
    const navAttempt = await navigateWithRetry(page, url, navTimeout);

    // Additional wait for dynamic content to settle
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info('Navigation complete', {
      url,
      waitUntil: navAttempt.waitUntil,
      timeout: navAttempt.timeout,
    });

    // Remove all iframes from the DOM to prevent axe frame analysis errors
    await page.evaluate(() => {
      document.querySelectorAll('iframe, frame').forEach((el) => el.remove());
    });

    // Run axe-core analysis targeting WCAG 2.1 AA
    const results = await new AxePuppeteer(page)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    // Extract site metadata (company name, contact info, etc.)
    const pageMetadata = await extractPageMetadata(page);

    const scanDuration = Date.now() - startTime;

    // Count violations by impact level
    const counts = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
    };

    for (const violation of results.violations) {
      const impact = violation.impact || 'minor';
      counts[impact] = (counts[impact] || 0) + violation.nodes.length;
    }

    const scanResult = {
      url,
      scannedAt: new Date().toISOString(),
      totalViolations: results.violations.reduce(
        (sum, v) => sum + v.nodes.length,
        0
      ),
      criticalCount: counts.critical,
      seriousCount: counts.serious,
      moderateCount: counts.moderate,
      minorCount: counts.minor,
      violations: results.violations.map(formatViolation),
      passedRules: results.passes.length,
      incompleteRules: results.incomplete.length,
      scanDurationMs: scanDuration,
      pageMetadata,
    };

    logger.info('Scan complete', {
      url,
      totalViolations: scanResult.totalViolations,
      durationMs: scanDuration,
    });

    return scanResult;
  } catch (error) {
    logger.error('Scan failed', { url, error: error.message });
    throw new Error(`Scan failed for ${url}: ${error.message}`);
  } finally {
    // Always close page. Close browser too when standalone mode is used.
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
    if (browser && !usedPool) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

/**
 * Formats a single axe-core violation into our standard shape.
 * Includes the broken HTML and a suggested fix.
 * @param {object} violation - An axe-core violation object.
 * @returns {object} Formatted violation.
 */
function formatViolation(violation) {
  return {
    id: violation.id,
    impact: violation.impact ?? 'minor',
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    wcagTags: violation.tags.filter(
      (t) =>
        t.startsWith('wcag') ||
        t.startsWith('best-practice') ||
        t.startsWith('section508')
    ),
    affectedElements: violation.nodes.map((node) => {
      const fix = generateFix(violation.id, node, violation);
      return {
        selector: node.target?.[0],
        currentCode: node.html,
        fixType: fix.fixType,
        explanation: fix.explanation,
        suggestedFix: fix.suggestedFix,
        actionRequired: fix.actionRequired,
        showCodeDiff: fix.showCodeDiff,
      };
    }),
  };
}

/**
 * Scans a page at both desktop (1280×1024) and mobile (375×812) viewports
 * and merges unique violations from both. Mobile-only violations are tagged.
 * @param {string} url - The URL to scan.
 * @param {object} [options] - Optional configuration.
 * @returns {Promise<object>} Merged scan results with viewport annotations.
 */
async function scanPageMultiViewport(url, options = {}) {
  const startTime = Date.now();

  // Desktop scan (default)
  const desktopResult = await scanPage(url, options);

  // Mobile scan with iPhone-like viewport
  let mobileResult;
  try {
    mobileResult = await scanPage(url, {
      ...options,
      viewport: { width: 375, height: 812 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  } catch (err) {
    logger.warn('Mobile viewport scan failed, using desktop-only results', { url, error: err.message });
    return desktopResult;
  }

  // Merge violations: desktop violations keep original, mobile-only get tagged
  const desktopViolationKeys = new Set(
    desktopResult.violations.map((v) => v.id)
  );

  const mobileOnlyViolations = mobileResult.violations
    .filter((v) => !desktopViolationKeys.has(v.id))
    .map((v) => ({ ...v, viewport: 'mobile-only' }));

  const mergedViolations = [
    ...desktopResult.violations.map((v) => ({ ...v, viewport: 'desktop' })),
    ...mobileOnlyViolations,
  ];

  const totalViolations = mergedViolations.reduce(
    (sum, v) => sum + (v.affectedElements?.length || 0),
    0
  );

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of mergedViolations) {
    const impact = v.impact || 'minor';
    counts[impact] = (counts[impact] || 0) + (v.affectedElements?.length || 0);
  }

  return {
    ...desktopResult,
    totalViolations,
    criticalCount: counts.critical,
    seriousCount: counts.serious,
    moderateCount: counts.moderate,
    minorCount: counts.minor,
    violations: mergedViolations,
    mobileOnlyViolationCount: mobileOnlyViolations.length,
    scanDurationMs: Date.now() - startTime,
  };
}

module.exports = { scanPage, scanPageMultiViewport, formatViolation, closeBrowserPool, extractPageMetadata };
