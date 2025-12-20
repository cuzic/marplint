/**
 * Rule: marp/japanese-consistency
 * Checks for consistent use of full-width/half-width characters in Japanese text
 */

import { type LineContext, visitSlides } from '../utils/slide-visitor.js';
import type { LintError } from './slide-line-count.js';

export interface JapaneseConsistencyConfig {
  enabled?: boolean;
  preferFullWidthNumbers?: boolean;
  preferFullWidthAlphabets?: boolean;
  checkPunctuation?: boolean;
  checkParentheses?: boolean;
  checkSpaceAroundEnglish?: boolean;
}

const DEFAULT_CONFIG: Required<JapaneseConsistencyConfig> = {
  enabled: true,
  preferFullWidthNumbers: false, // Usually half-width is preferred
  preferFullWidthAlphabets: false,
  checkPunctuation: true,
  checkParentheses: true,
  checkSpaceAroundEnglish: true
};

// Character patterns
const FULL_WIDTH_NUMBERS = /[０-９]/g;
const FULL_WIDTH_ALPHABETS = /[Ａ-Ｚａ-ｚ]/g;
const MIXED_PUNCTUATION = /[、。].*[,.]|[,.].*[、。]/;
const FULL_WIDTH_PARENS = /[（）「」『』【】]/g;
const HALF_WIDTH_PARENS = /[()[\]]/g;

export function japaneseConsistency(content: string, config: JapaneseConsistencyConfig = {}): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const errors: LintError[] = [];

  visitSlides(content, {
    onLine(line: string, context: LineContext) {
      // Skip HTML comments
      if (line.trim().startsWith('<!--')) return;

      // Skip URLs and code spans
      const textToCheck = line
        .replace(/`[^`]+`/g, '') // Remove inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text only
        .replace(/https?:\/\/[^\s]+/g, ''); // Remove URLs

      // Check full-width numbers (if preferring half-width)
      if (!mergedConfig.preferFullWidthNumbers) {
        const fullWidthNums = textToCheck.match(FULL_WIDTH_NUMBERS);
        if (fullWidthNums && fullWidthNums.length > 0) {
          errors.push({
            ruleId: 'marp/japanese-consistency',
            slideNumber: context.slideNumber,
            lineNumber: context.lineNumber,
            message: `Slide ${context.slideNumber}: Full-width numbers found. Consider using half-width: ${fullWidthNums.join('')}`,
            severity: 'warning'
          });
        }
      }

      // Check full-width alphabets (if preferring half-width)
      if (!mergedConfig.preferFullWidthAlphabets) {
        const fullWidthAlpha = textToCheck.match(FULL_WIDTH_ALPHABETS);
        if (fullWidthAlpha && fullWidthAlpha.length > 0) {
          errors.push({
            ruleId: 'marp/japanese-consistency',
            slideNumber: context.slideNumber,
            lineNumber: context.lineNumber,
            message: `Slide ${context.slideNumber}: Full-width alphabets found. Consider using half-width: ${fullWidthAlpha.join('')}`,
            severity: 'warning'
          });
        }
      }

      // Check mixed punctuation
      if (mergedConfig.checkPunctuation && MIXED_PUNCTUATION.test(textToCheck)) {
        errors.push({
          ruleId: 'marp/japanese-consistency',
          slideNumber: context.slideNumber,
          lineNumber: context.lineNumber,
          message: `Slide ${context.slideNumber}: Mixed Japanese and Western punctuation. Use consistent style.`,
          severity: 'warning'
        });
      }

      // Check mixed parentheses in Japanese context
      if (mergedConfig.checkParentheses) {
        const hasFullWidthParens = FULL_WIDTH_PARENS.test(textToCheck);
        const hasHalfWidthParens = HALF_WIDTH_PARENS.test(textToCheck);
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(textToCheck);

        if (hasJapanese && hasFullWidthParens && hasHalfWidthParens) {
          errors.push({
            ruleId: 'marp/japanese-consistency',
            slideNumber: context.slideNumber,
            lineNumber: context.lineNumber,
            message: `Slide ${context.slideNumber}: Mixed full-width and half-width parentheses. Consider using consistent style.`,
            severity: 'warning'
          });
        }
      }
    }
  });

  return errors;
}
