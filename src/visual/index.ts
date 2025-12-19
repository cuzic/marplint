/**
 * Visual rules for marplint (Playwright-based)
 */

export { checkOverflow, type OverflowCheckerConfig, type OverflowResult } from './overflow-checker.js';
export { checkWhitespace, type WhitespaceCheckerConfig, type WhitespaceResult } from './whitespace-checker.js';
export { checkFontReadability, type FontReadabilityConfig, type FontReadabilityResult } from './font-readability.js';
export { checkColorContrast, type ColorContrastConfig, type ColorContrastResult } from './color-contrast.js';
export { checkElementOverlap, type ElementOverlapConfig, type ElementOverlapResult } from './element-overlap.js';
export { checkTextTruncation, type TextTruncationConfig, type TextTruncationResult } from './text-truncation.js';

import { checkOverflow } from './overflow-checker.js';
import { checkWhitespace } from './whitespace-checker.js';
import { checkFontReadability } from './font-readability.js';
import { checkColorContrast } from './color-contrast.js';
import { checkElementOverlap } from './element-overlap.js';
import { checkTextTruncation } from './text-truncation.js';
import type { LintError } from '../rules/slide-line-count.js';
import type { MarplintConfig } from '../utils/config.js';

export interface VisualLintResult {
  errors: LintError[];
  warnings: LintError[];
  overflowResults: import('./overflow-checker.js').OverflowResult[];
  whitespaceResults: import('./whitespace-checker.js').WhitespaceResult[];
  fontReadabilityResults?: import('./font-readability.js').FontReadabilityResult[];
  colorContrastResults?: import('./color-contrast.js').ColorContrastResult[];
  elementOverlapResults?: import('./element-overlap.js').ElementOverlapResult[];
  textTruncationResults?: import('./text-truncation.js').TextTruncationResult[];
}

/**
 * Helper to get rule config
 */
function getVisualRuleConfig<T>(config: MarplintConfig, ruleName: string): T | undefined {
  const ruleConfig = (config.rules as Record<string, unknown>)[ruleName];
  if (ruleConfig === false) return undefined;
  if (typeof ruleConfig === 'object') return ruleConfig as T;
  return {} as T;
}

/**
 * Run all visual rules on a markdown file
 */
export async function runVisualRules(
  markdownPath: string,
  config: MarplintConfig
): Promise<VisualLintResult> {
  const allErrors: LintError[] = [];
  let overflowResults: import('./overflow-checker.js').OverflowResult[] = [];
  let whitespaceResults: import('./whitespace-checker.js').WhitespaceResult[] = [];
  let fontReadabilityResults: import('./font-readability.js').FontReadabilityResult[] | undefined;
  let colorContrastResults: import('./color-contrast.js').ColorContrastResult[] | undefined;
  let elementOverlapResults: import('./element-overlap.js').ElementOverlapResult[] | undefined;
  let textTruncationResults: import('./text-truncation.js').TextTruncationResult[] | undefined;

  // Run overflow check
  const overflowConfig = getVisualRuleConfig(config, 'marp/overflow');
  if (overflowConfig !== undefined) {
    const { errors, results } = await checkOverflow(markdownPath, {
      ...overflowConfig,
      viewport: config.viewport
    });
    allErrors.push(...errors);
    overflowResults = results;
  }

  // Run whitespace check
  const whitespaceConfig = getVisualRuleConfig(config, 'marp/whitespace');
  if (whitespaceConfig !== undefined) {
    const { errors, results } = await checkWhitespace(markdownPath, {
      ...whitespaceConfig,
      viewport: config.viewport
    });
    allErrors.push(...errors);
    whitespaceResults = results;
  }

  // Run font readability check
  const fontConfig = getVisualRuleConfig(config, 'marp/font-readability');
  if (fontConfig !== undefined) {
    const { errors, results } = await checkFontReadability(markdownPath, {
      ...fontConfig,
      viewport: config.viewport
    });
    allErrors.push(...errors);
    fontReadabilityResults = results;
  }

  // Run color contrast check
  const contrastConfig = getVisualRuleConfig(config, 'marp/color-contrast');
  if (contrastConfig !== undefined) {
    const { errors, results } = await checkColorContrast(markdownPath, {
      ...contrastConfig,
      viewport: config.viewport
    });
    allErrors.push(...errors);
    colorContrastResults = results;
  }

  // Run element overlap check
  const overlapConfig = getVisualRuleConfig(config, 'marp/element-overlap');
  if (overlapConfig !== undefined) {
    const { errors, results } = await checkElementOverlap(markdownPath, {
      ...overlapConfig,
      viewport: config.viewport
    });
    allErrors.push(...errors);
    elementOverlapResults = results;
  }

  // Run text truncation check
  const truncConfig = getVisualRuleConfig(config, 'marp/text-truncation');
  if (truncConfig !== undefined) {
    const { errors, results } = await checkTextTruncation(markdownPath, {
      ...truncConfig,
      viewport: config.viewport
    });
    allErrors.push(...errors);
    textTruncationResults = results;
  }

  return {
    errors: allErrors.filter(e => e.severity === 'error'),
    warnings: allErrors.filter(e => e.severity === 'warning'),
    overflowResults,
    whitespaceResults,
    fontReadabilityResults,
    colorContrastResults,
    elementOverlapResults,
    textTruncationResults
  };
}
