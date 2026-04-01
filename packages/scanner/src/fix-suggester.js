'use strict';

// ── Colour contrast helpers ──────────────────────────────────────────────────

function hexToRgb(hex) {
  const clean = hex.replace(/^#/, '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function getRelativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Generates a structured fix for an axe-core violation node.
 * Violations fall into three categories:
 *   HTML      — the fix is a direct change to the element's HTML (show code diff)
 *   CSS       — the HTML is correct; the fix is in a stylesheet (show instructions)
 *   STRUCTURE — the fix requires understanding the whole page (show step-by-step)
 *   REVIEW    — generic fallback (show instructions)
 *
 * @param {string} violationId - The axe-core rule ID (e.g. 'image-alt').
 * @param {object} node - The axe-core node object.
 * @param {object} violation - The full axe-core violation object.
 * @returns {object} Fix descriptor with fixType, showCodeDiff, explanation, suggestedFix, actionRequired.
 */
function generateFix(violationId, node, violation) {
  const fixes = {

    // ============================================
    // COLOR CONTRAST — fix is ALWAYS in CSS
    // ============================================
    'color-contrast': {
      fixType: 'CSS',
      showCodeDiff: false,
      explanation:
        "This element's text colour does not have enough contrast against its background. " +
        'The HTML is correct — the fix must be made in your CSS file.',
      suggestedFix: (() => {
        // Extract contrast data from axe-core failure summary if available
        const fgMatch = node.failureSummary?.match(/foreground color: (#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/i);
        const bgMatch = node.failureSummary?.match(/background color: (#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/i);
        // axe-core reports: "insufficient color contrast of X.X"
        const actualRatioMatch = node.failureSummary?.match(/insufficient color contrast of ([\d.]+)/i);
        // axe-core reports: "Expected contrast ratio of X.X:1"
        const minRatioMatch = node.failureSummary?.match(/Expected contrast ratio of ([\d.]+)/i);

        const currentFg = fgMatch ? fgMatch[1] : 'unknown';
        const currentBg = bgMatch ? bgMatch[1] : 'unknown';
        const actualRatio = actualRatioMatch ? parseFloat(actualRatioMatch[1]) : null;
        const minRatio = minRatioMatch ? parseFloat(minRatioMatch[1]) : 4.5;

        const ratioDisplay = actualRatio !== null ? `${actualRatio}:1` : 'below minimum';
        const minDisplay = `${minRatio}:1`;

        // Exact-minimum note: WCAG AA requires STRICTLY MORE THAN 4.5:1 for normal text
        const exactFailNote =
          actualRatio !== null && Math.abs(actualRatio - minRatio) < 0.05
            ? `\n  ⚠ NOTE: A ratio of exactly ${actualRatio}:1 does NOT pass WCAG AA.\n  The minimum means your ratio must be strictly above ${minRatio}:1 (e.g. ${(minRatio + 0.1).toFixed(1)}:1 or higher).`
            : '';

        // Determine background brightness to give context-correct options
        const bgLuminance = currentBg.startsWith('#') ? getRelativeLuminance(currentBg) : null;
        const isDarkBg = bgLuminance !== null ? bgLuminance < 0.18 : null;

        let optionsBlock;
        if (isDarkBg === true) {
          optionsBlock = `  RECOMMENDED FIX for DARK background (${currentBg}):
  Your background is dark — your text must be LIGHTER, not darker.

  Option A: Use white text (highest contrast, always passes)
    color: #ffffff; /* 21:1 contrast on pure black */

  Option B: Use off-white text
    color: #f5f5f5; /* very high contrast on dark backgrounds */

  Option C: Lighten the background colour
    /* Use a lighter shade of ${currentBg} in your CSS */`;
        } else if (isDarkBg === false) {
          optionsBlock = `  RECOMMENDED FIX for LIGHT background (${currentBg}):
  Your background is light — your text must be DARKER.

  Option A: Use near-black text (safest choice)
    color: #1a1a1a; /* 19:1 contrast on white */

  Option B: Use dark grey text
    color: #333333; /* 12.6:1 contrast on white */

  Option C: Darken the background colour
    /* Use a darker shade of ${currentBg} in your CSS */`;
        } else {
          optionsBlock = `  RECOMMENDED FIX — choose one:

  Option A: Darken the text (use this if background is light)
    color: #1a1a1a; /* 19:1 contrast on white */

  Option B: Lighten the text (use this if background is dark)
    color: #f5f5f5; /* high contrast on dark backgrounds */

  Option C: Change the background colour to pass contrast
    /* Adjust background-color in your CSS file */`;
        }

        return `/* 
  CURRENT ISSUE:
  Selector: ${node.target?.[0] || 'see element above'}
  Foreground: ${currentFg}
  Background: ${currentBg}
  Current contrast ratio: ${ratioDisplay}
  Minimum required: strictly above ${minDisplay}
  Status: FAILS${exactFailNote}

${optionsBlock}

  VERIFY YOUR FIX:
  https://webaim.org/resources/contrastchecker/
  Enter Foreground: ${currentFg}  Background: ${currentBg}

  MINIMUMS (WCAG 2.1 AA):
  - Normal text (under 18pt / 14pt bold): must exceed 4.5:1
  - Large text (18pt+ or 14pt bold): must exceed 3:1
*/`;
      })(),
      actionRequired: 'Update CSS colour values — not HTML',
    },

    // ============================================
    // MISSING ALT TEXT — fix IS in HTML
    // ============================================
    'image-alt': {
      fixType: 'HTML',
      showCodeDiff: true,
      explanation:
        'This image has no alt text. Screen readers announce it as "image" with no description.',
      currentCode: node.html,
      suggestedFix: node.html.includes('alt=')
        ? node.html.replace(/alt=""/g, 'alt="Describe what this image shows"')
        : node.html.replace('<img', '<img alt="Describe what this image shows"'),
      actionRequired: 'Add descriptive alt text to the img tag',
    },

    // ============================================
    // MISSING FORM LABEL — fix IS in HTML
    // ============================================
    label: {
      fixType: 'HTML',
      showCodeDiff: true,
      explanation:
        'This form field has no label. Screen readers cannot tell users what to type here.',
      currentCode: node.html,
      suggestedFix: `<!-- Add this LABEL element directly before your input -->
<label for="field-id">Your field name here</label>

<!-- Then add matching id to your input -->
${node.html.replace(/<input/, '<input id="field-id"')}

<!-- OR use aria-label if you cannot add a visible label -->
${node.html.replace(/<input/, '<input aria-label="Describe this field"')}`,
      actionRequired: 'Add a label element linked to this input',
    },

    // ============================================
    // EMPTY LINK — fix IS in HTML
    // ============================================
    'link-name': {
      fixType: 'HTML',
      showCodeDiff: true,
      explanation:
        'This link has no accessible name. Screen readers announce it as "link" with no description of where it goes.',
      currentCode: node.html,
      suggestedFix: (() => {
        if (node.html.includes('<img')) {
          return node.html.replace(/<img/, '<img alt="Describe link destination"');
        }
        if (node.html.match(/<a[^>]*><\/a>/)) {
          return node.html.replace(/(<a[^>]*>)(<\/a>)/, '$1Describe where this link goes$2');
        }
        return node.html.replace(/<a/, '<a aria-label="Describe where this link goes"');
      })(),
      actionRequired: 'Add descriptive text or aria-label to the link',
    },

    // ============================================
    // EMPTY BUTTON — fix IS in HTML
    // ============================================
    'button-name': {
      fixType: 'HTML',
      showCodeDiff: true,
      explanation:
        'This button has no accessible name. Screen readers announce it as "button" with no description of what it does.',
      currentCode: node.html,
      suggestedFix: (() => {
        if (node.html.includes('svg') || node.html.includes('icon')) {
          return node.html.replace(
            /<button/,
            '<button aria-label="Describe what this button does"'
          );
        }
        if (node.html.match(/<button[^>]*><\/button>/)) {
          return node.html.replace(
            /(<button[^>]*>)(<\/button>)/,
            '$1Click here$2'
          );
        }
        return node.html.replace(
          /<button/,
          '<button aria-label="Describe what this button does"'
        );
      })(),
      actionRequired: 'Add aria-label or visible text to the button',
    },

    // ============================================
    // MISSING DOCUMENT LANGUAGE — fix IS in HTML
    // ============================================
    'html-has-lang': {
      fixType: 'HTML',
      showCodeDiff: true,
      explanation:
        'Your page has no language declared. Screen readers cannot use the correct pronunciation rules.',
      currentCode: '<html>',
      suggestedFix: '<html lang="en">',
      actionRequired: 'Add lang="en" attribute to your root <html> tag',
    },

    // ============================================
    // HEADING ORDER — structural fix
    // ============================================
    'heading-order': {
      fixType: 'STRUCTURE',
      showCodeDiff: false,
      explanation:
        'Your headings skip levels — for example jumping from H1 directly to H4. ' +
        'Screen reader users navigate pages using headings like a table of contents. ' +
        'Skipped heading levels break this navigation completely.',
      suggestedFix: `/* 
  HOW TO FIX HEADING ORDER:
  
  RULE: Headings must go in sequence — H1 → H2 → H3 → H4
        You can skip levels GOING UP but never GOING DOWN
  
  YOUR PROBLEM ELEMENT:
  ${node.html}
  
  STEP 1: Open your page and run this in browser console:
  document.querySelectorAll('h1,h2,h3,h4,h5,h6')
    .forEach(h => console.log(h.tagName, h.textContent.trim()))
  
  STEP 2: Look for jumps in the sequence (e.g. H1 → H4)
  
  STEP 3: Either:
  → Change this element to the correct heading level
  → OR add visually-hidden headings in between using class="sr-only"
  
  EXAMPLE FIX:
  Before: <h4>Quick Links</h4>  ← wrong if H2/H3 missing above
  After:  <h2>Quick Links</h2>  ← correct if this is a major section
*/`,
      actionRequired: 'Review all headings on the page and fix the sequence',
    },

    // ============================================
    // MISSING MAIN LANDMARK
    // ============================================
    'landmark-one-main': {
      fixType: 'STRUCTURE',
      showCodeDiff: false,
      explanation:
        'Your page has no <main> element. Screen reader users cannot skip directly to the main content, ' +
        'forcing them to navigate through every header link first.',
      suggestedFix: `/* 
  HOW TO FIX:
  
  Wrap your primary page content in a <main> element.
  There should be exactly ONE <main> per page.
  
  BEFORE (broken):
  <body>
    <nav>...</nav>
    <div class="content">    ← this div
      {page content}
    </div>
    <footer>...</footer>
  </body>
  
  AFTER (fixed):
  <body>
    <nav>...</nav>
    <main class="content">   ← changed to main
      {page content}
    </main>
    <footer>...</footer>
  </body>
  
  In Next.js — update your layout.tsx:
  Change: <div>{children}</div>
  To:     <main>{children}</main>
*/`,
      actionRequired: 'Wrap your primary content in a <main> HTML element',
    },

    // ============================================
    // CONTENTINFO (FOOTER) NOT AT TOP LEVEL
    // ============================================
    'landmark-contentinfo-is-top-level': {
      fixType: 'STRUCTURE',
      showCodeDiff: false,
      explanation:
        'Your <footer> element is nested inside another landmark (e.g. <main> or <section>). ' +
        'The contentinfo landmark must be a direct child of <body>.',
      suggestedFix: `/* 
  HOW TO FIX:

  Your <footer> is currently nested inside <main> or another
  landmark — this breaks screen reader navigation.

  WRONG structure (your current code):
  <body>
    <main>
      <section>...</section>
      <footer>...</footer>  ← footer inside main = WRONG
    </main>
  </body>

  CORRECT structure:
  <body>
    <header>...</header>
    <main>
      <section>...</section>
    </main>
    <footer>...</footer>  ← footer directly in body = CORRECT
  </body>

  In Next.js — check your layout.tsx:
  Make sure <footer> is OUTSIDE and AFTER </main>.
  Never place <footer> inside <main> or <section>.
*/`,
      actionRequired: 'Move <footer> outside of <main> — place it directly inside <body>',
    },

    // ============================================
    // CONTENT NOT IN LANDMARKS (region)
    // ============================================
    region: {
      fixType: 'STRUCTURE',
      showCodeDiff: false,
      explanation:
        'This content is not inside any landmark element (main, nav, header, footer, section, aside). ' +
        'Screen reader users cannot navigate to it using landmark shortcuts.',
      suggestedFix: `/*
  HOW TO FIX:
  
  Wrap this content in an appropriate landmark element.
  
  ELEMENT WITH PROBLEM:
  ${node.html.substring(0, 100)}...
  
  CHOOSE THE RIGHT WRAPPER:
  
  <header>  → site logo, main navigation, search bar
  <nav>     → navigation menus and link lists  
  <main>    → primary page content (ONE per page)
  <section> → distinct sections within main content
              Add aria-labelledby pointing to a heading inside
  <aside>   → sidebars, related links, ads
  <footer>  → copyright, secondary nav, contact info
  
  EXAMPLE FIX for a content section:
  
  Before:
  <div class="features">
    <h2>Features</h2>
    ...content...
  </div>
  
  After:
  <section aria-labelledby="features-heading">
    <h2 id="features-heading">Features</h2>
    ...content...
  </section>
*/`,
      actionRequired: 'Wrap content in appropriate HTML landmark element',
    },
  };

  if (fixes[violationId]) {
    return fixes[violationId];
  }

  // ============================================
  // GENERIC FALLBACK — for unknown violations
  // ============================================
  return {
    fixType: 'REVIEW',
    showCodeDiff: false,
    explanation: violation.description,
    suggestedFix: `/*
  WHAT IS WRONG:
  ${violation.description}
  
  ELEMENT WITH PROBLEM:
  ${node.html.substring(0, 200)}
  
  HOW TO FIX:
  ${node.failureSummary}
  
  LEARN MORE:
  ${violation.helpUrl}
*/`,
    actionRequired: node.failureSummary,
  };
}

module.exports = { generateFix };
