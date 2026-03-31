'use strict';

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
        const ratioMatch = node.failureSummary?.match(/contrast ratio of ([\d.]+)/i);

        const currentFg = fgMatch ? fgMatch[1] : 'unknown';
        const currentBg = bgMatch ? bgMatch[1] : 'unknown';
        const ratio = ratioMatch ? ratioMatch[1] : 'below minimum';

        // Pre-computed accessible dark text options on common backgrounds
        const safeTextColors = {
          dark: '#1a1a1a',    // works on any light bg (19:1 on white)
          medium: '#2d2d2d',  // works on light grays (15:1 on #f5f5f5)
          onDark: '#e8e8e8',  // works on dark bg (13:1 on #1a1a1a)
        };

        return `/* 
  CURRENT ISSUE:
  Selector: ${node.target?.[0] || 'see element above'}
  Foreground: ${currentFg}
  Background: ${currentBg}
  Current contrast ratio: ${ratio} (minimum required: 4.5:1)
  
  RECOMMENDED FIX — choose one:
  
  Option A: Darken the text (if background is light)
    color: ${safeTextColors.dark};  /* 19:1 contrast on white */
  
  Option B: Lighten the text (if background is dark)
    color: ${safeTextColors.onDark};  /* 13:1 contrast on #1a1a1a */
  
  Option C: Increase background lightness
    background-color: #ffffff;
  
  VERIFY YOUR FIX:
  https://webaim.org/resources/contrastchecker/
  
  MINIMUMS:
  - Normal text (under 18pt): ratio must be 4.5:1 or higher
  - Large text (18pt+ or 14pt bold): ratio must be 3:1 or higher
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
