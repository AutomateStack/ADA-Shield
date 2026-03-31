const { logger } = require('./utils/logger');

/**
 * Violation rules that frequently trigger ADA lawsuits.
 * Weighted higher in the risk score calculation.
 * @type {Record<string, { critical: number, serious: number }>}
 */
const LAWSUIT_TRIGGER_RULES = {
  'color-contrast': { critical: 20, serious: 15 },
  'image-alt': { critical: 20, serious: 15 },
  'label': { critical: 20, serious: 15 },
  'link-name': { critical: 15, serious: 10 },
  'button-name': { critical: 15, serious: 10 },
  'html-has-lang': { critical: 10, serious: 10 },
};

/**
 * Point values for general violations by impact level.
 * @type {Record<string, number>}
 */
const GENERAL_IMPACT_POINTS = {
  critical: 10,
  serious: 7,
  moderate: 4,
  minor: 2,
};

/**
 * Risk score thresholds for categorization.
 */
const RISK_LEVELS = {
  LOW: { min: 0, max: 29, label: 'Low', color: 'green' },
  MEDIUM: { min: 30, max: 59, label: 'Medium', color: 'amber' },
  HIGH: { min: 60, max: 100, label: 'High', color: 'red' },
};

/**
 * Calculates the ADA lawsuit risk score (0–100) from scan violations.
 *
 * Uses a logarithmic diminishing-returns model: the first few critical
 * violations shoot the score up fast, but additional violations of the 
 * same type have decreasing impact. This more accurately reflects real
 * lawsuit risk (1 image-alt violation on 50 images ≠ 50× the risk of 1).
 *
 * Lawsuit-triggering rules (color-contrast, image-alt, label, link-name,
 * button-name, html-has-lang) are weighted more heavily. All other
 * violations use standard impact-level scoring.
 *
 * @param {Array<object>} violations - Array of formatted violations from scanPage().
 * @returns {{ score: number, level: string, color: string, breakdown: object }}
 */
function calculateRiskScore(violations) {
  try {
    let totalPoints = 0;
    const breakdown = {
      lawsuitTriggers: {},
      generalViolations: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      uniqueRuleCount: 0,
    };

    // Track unique violation types for diversity bonus
    const uniqueRules = new Set();

    for (const violation of violations) {
      const ruleId = violation.id;
      const impact = violation.impact || 'minor';
      const nodeCount = (violation.affectedElements ?? violation.nodes)?.length ?? 1;
      uniqueRules.add(ruleId);

      if (LAWSUIT_TRIGGER_RULES[ruleId]) {
        const rule = LAWSUIT_TRIGGER_RULES[ruleId];

        // html-has-lang is flat-rate (not per-node)
        if (ruleId === 'html-has-lang') {
          const points = rule[impact] || rule.serious;
          totalPoints += points;
          breakdown.lawsuitTriggers[ruleId] = points;
        } else {
          const pointsPer = rule[impact] || rule.serious;
          // Diminishing returns: first node gets full points, subsequent nodes
          // add less (logarithmic scale). This prevents 50 missing alt tags
          // from maxing the score when 3 is already very bad.
          const points = pointsPer * (1 + Math.log2(nodeCount));
          totalPoints += points;
          breakdown.lawsuitTriggers[ruleId] = Math.round(points);
        }
      } else {
        const pointsPer = GENERAL_IMPACT_POINTS[impact] || GENERAL_IMPACT_POINTS.minor;
        const points = pointsPer * (1 + Math.log2(nodeCount));
        totalPoints += points;
        breakdown.generalViolations[impact] += Math.round(points);
      }
    }

    // Diversity bonus: more unique violation TYPES = higher real risk
    // (a site with 5 different issue types is more likely to be sued
    // than one with 50 instances of a single issue)
    breakdown.uniqueRuleCount = uniqueRules.size;
    if (uniqueRules.size >= 5) totalPoints *= 1.15;
    else if (uniqueRules.size >= 3) totalPoints *= 1.05;

    // Cap at 100
    const score = Math.min(Math.round(totalPoints), 100);

    // Determine risk level
    let level, color;
    if (score <= RISK_LEVELS.LOW.max) {
      level = RISK_LEVELS.LOW.label;
      color = RISK_LEVELS.LOW.color;
    } else if (score <= RISK_LEVELS.MEDIUM.max) {
      level = RISK_LEVELS.MEDIUM.label;
      color = RISK_LEVELS.MEDIUM.color;
    } else {
      level = RISK_LEVELS.HIGH.label;
      color = RISK_LEVELS.HIGH.color;
    }

    logger.info('Risk score calculated', { score, level, totalPoints });

    return { score, level, color, breakdown };
  } catch (error) {
    logger.error('Risk score calculation failed', { error: error.message });
    throw new Error(`Risk score calculation failed: ${error.message}`);
  }
}

/**
 * Returns the risk level metadata for a given score.
 * @param {number} score - Risk score 0-100.
 * @returns {{ label: string, color: string }}
 */
function getRiskLevel(score) {
  if (score <= RISK_LEVELS.LOW.max) return RISK_LEVELS.LOW;
  if (score <= RISK_LEVELS.MEDIUM.max) return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.HIGH;
}

module.exports = {
  calculateRiskScore,
  getRiskLevel,
  LAWSUIT_TRIGGER_RULES,
  GENERAL_IMPACT_POINTS,
  RISK_LEVELS,
};
