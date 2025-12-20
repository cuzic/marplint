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

/** Clean text for analysis by removing code and URLs */
function cleanTextForAnalysis(line: string): string {
  return line
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s]+/g, '');
}

/** Check and report full-width numbers */
function checkFullWidthNumbers(text: string, context: LineContext, errors: LintError[]): void {
  const matches = text.match(FULL_WIDTH_NUMBERS);
  if (matches?.length) {
    errors.push({
      ruleId: 'marp/japanese-consistency',
      slideNumber: context.slideNumber,
      lineNumber: context.lineNumber,
      message: `Slide ${context.slideNumber}: Full-width numbers found. Consider using half-width: ${matches.join('')}`,
      severity: 'warning'
    });
  }
}

/** Check and report full-width alphabets */
function checkFullWidthAlphabets(text: string, context: LineContext, errors: LintError[]): void {
  const matches = text.match(FULL_WIDTH_ALPHABETS);
  if (matches?.length) {
    errors.push({
      ruleId: 'marp/japanese-consistency',
      slideNumber: context.slideNumber,
      lineNumber: context.lineNumber,
      message: `Slide ${context.slideNumber}: Full-width alphabets found. Consider using half-width: ${matches.join('')}`,
      severity: 'warning'
    });
  }
}

/** Check and report mixed punctuation */
function checkMixedPunctuation(text: string, context: LineContext, errors: LintError[]): void {
  if (MIXED_PUNCTUATION.test(text)) {
    errors.push({
      ruleId: 'marp/japanese-consistency',
      slideNumber: context.slideNumber,
      lineNumber: context.lineNumber,
      message: `Slide ${context.slideNumber}: Mixed Japanese and Western punctuation. Use consistent style.`,
      severity: 'warning'
    });
  }
}

/** Check and report mixed parentheses */
function checkMixedParentheses(text: string, context: LineContext, errors: LintError[]): void {
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  if (hasJapanese && FULL_WIDTH_PARENS.test(text) && HALF_WIDTH_PARENS.test(text)) {
    errors.push({
      ruleId: 'marp/japanese-consistency',
      slideNumber: context.slideNumber,
      lineNumber: context.lineNumber,
      message: `Slide ${context.slideNumber}: Mixed full-width and half-width parentheses. Consider using consistent style.`,
      severity: 'warning'
    });
  }
}

export function japaneseConsistency(content: string, config: JapaneseConsistencyConfig = {}): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  if (!mergedConfig.enabled) return [];

  const errors: LintError[] = [];

  visitSlides(content, {
    onLine(line: string, context: LineContext) {
      if (line.trim().startsWith('<!--')) return;

      const text = cleanTextForAnalysis(line);

      if (!mergedConfig.preferFullWidthNumbers) checkFullWidthNumbers(text, context, errors);
      if (!mergedConfig.preferFullWidthAlphabets) checkFullWidthAlphabets(text, context, errors);
      if (mergedConfig.checkPunctuation) checkMixedPunctuation(text, context, errors);
      if (mergedConfig.checkParentheses) checkMixedParentheses(text, context, errors);
    }
  });

  return errors;
}
