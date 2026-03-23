const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const { logger } = require('./utils/logger');

/**
 * Default Puppeteer launch options
 * @type {import('puppeteer').LaunchOptions}
 */
const DEFAULT_BROWSER_OPTIONS = {
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
  ],
  timeout: 30000,
};

/**
 * Default page navigation options
 * @type {import('puppeteer').GoToOptions}
 */
const DEFAULT_NAV_OPTIONS = {
  waitUntil: 'networkidle2',
  timeout: 30000,
};

/**
 * Scans a single page for WCAG 2.1 AA accessibility violations using axe-core.
 * @param {string} url - The URL to scan.
 * @param {object} [options] - Optional configuration.
 * @param {number} [options.timeout=30000] - Navigation timeout in ms.
 * @returns {Promise<object>} The axe-core analysis results with violation counts.
 */
async function scanPage(url, options = {}) {
  const startTime = Date.now();
  let browser = null;

  try {
    logger.info('Starting scan', { url });

    browser = await puppeteer.launch(DEFAULT_BROWSER_OPTIONS);
    const page = await browser.newPage();

    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Allow axe-core injection even on pages with strict CSP
    await page.setBypassCSP(true);

    // Navigate to the page — use 'load' instead of 'networkidle2'
    // to avoid hanging on sites with persistent connections
    await page.goto(url, {
      waitUntil: 'load',
      timeout: options.timeout || DEFAULT_NAV_OPTIONS.timeout,
    });

    // Additional wait for dynamic content to settle
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Remove all iframes from the DOM to prevent axe frame analysis errors
    await page.evaluate(() => {
      document.querySelectorAll('iframe, frame').forEach((el) => el.remove());
    });

    // Run axe-core analysis targeting WCAG 2.1 AA
    const results = await new AxePuppeteer(page)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

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
    if (browser) {
      await browser.close();
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
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    wcagTags: violation.tags.filter(
      (t) =>
        t.startsWith('wcag') ||
        t.startsWith('best-practice') ||
        t.startsWith('section508')
    ),
    nodes: violation.nodes.map((node) => ({
      html: node.html,
      target: node.target,
      failureSummary: node.failureSummary,
      fix: generateFix(violation.id, node),
    })),
  };
}

/**
 * Generates a concrete code fix suggestion for a violation node.
 * @param {string} ruleId - The axe-core rule ID (e.g. 'image-alt').
 * @param {object} node - The axe-core node object.
 * @returns {object} An object with fixedHtml and explanation.
 */
function generateFix(ruleId, node) {
  const html = node.html || '';
  let fixedHtml = html;
  let explanation = '';

  switch (ruleId) {
    case 'image-alt': {
      if (html.includes('<img')) {
        if (/alt\s*=/.test(html)) {
          // Replace empty alt with descriptive placeholder
          fixedHtml = html.replace(/alt\s*=\s*"[^"]*"/, 'alt="Descriptive text here"');
        } else {
          fixedHtml = html.replace(/<img/, '<img alt="Descriptive text here"');
        }
        explanation =
          'Add a descriptive alt attribute that conveys the purpose of the image.';
      }
      break;
    }
    case 'color-contrast': {
      explanation =
        'Increase the contrast ratio between foreground text and background color ' +
        'to at least 4.5:1 for normal text or 3:1 for large text. ' +
        'Use a contrast checker to find compliant color combinations.';
      fixedHtml = html + ' /* Update CSS: increase color contrast ratio */';
      break;
    }
    case 'label': {
      if (html.includes('<input')) {
        const idMatch = html.match(/id="([^"]+)"/);
        const id = idMatch ? idMatch[1] : 'input-id';
        fixedHtml = `<label for="${id}">Field label</label>\n${html}`;
        explanation = 'Add a <label> element associated with this form input using the for attribute.';
      }
      break;
    }
    case 'link-name': {
      fixedHtml = html.replace(/<a /, '<a aria-label="Descriptive link text" ');
      explanation =
        'Add descriptive text content or an aria-label to the link so screen readers can announce it.';
      break;
    }
    case 'button-name': {
      fixedHtml = html.replace(/<button/, '<button aria-label="Button purpose"');
      explanation =
        'Add text content or an aria-label to the button describing its action.';
      break;
    }
    case 'html-has-lang': {
      fixedHtml = '<html lang="en">';
      explanation =
        'Add a lang attribute to the <html> element to declare the page language.';
      break;
    }
    default: {
      explanation =
        node.failureSummary ||
        'Review the violation details at the helpUrl and apply the recommended fix.';
      break;
    }
  }

  return { fixedHtml, explanation };
}

module.exports = { scanPage, formatViolation, generateFix };
