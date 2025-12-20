/**
 * Rule: marp/missing-font-class
 * Suggests adding font-class when content is dense
 */

import { countContentLines, getFontClassLevel, parseSlides } from '../utils/slide-parser.js';
import type { LintError } from './slide-line-count.js';

export interface MissingFontClassConfig {
  enabled?: boolean;
  thresholds?: {
    small?: number; // Lines threshold for font-small
    xsmall?: number; // Lines threshold for font-xsmall
    xxsmall?: number; // Lines threshold for font-xxsmall
  };
}

interface ResolvedMissingFontClassConfig {
  enabled: boolean;
  thresholds: {
    small: number;
    xsmall: number;
    xxsmall: number;
  };
}

const DEFAULT_CONFIG: ResolvedMissingFontClassConfig = {
  enabled: true,
  thresholds: {
    small: 15,
    xsmall: 20,
    xxsmall: 25
  }
};

function mergeConfig(config: MissingFontClassConfig): ResolvedMissingFontClassConfig {
  return {
    enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
    thresholds: {
      small: config.thresholds?.small ?? DEFAULT_CONFIG.thresholds.small,
      xsmall: config.thresholds?.xsmall ?? DEFAULT_CONFIG.thresholds.xsmall,
      xxsmall: config.thresholds?.xxsmall ?? DEFAULT_CONFIG.thresholds.xxsmall
    }
  };
}

function getSuggestedFontClass(
  lineCount: number,
  currentLevel: number,
  thresholds: ResolvedMissingFontClassConfig['thresholds']
): string | null {
  if (lineCount >= thresholds.xxsmall && currentLevel < 3) return 'font-xxsmall';
  if (lineCount >= thresholds.xsmall && currentLevel < 2) return 'font-xsmall';
  if (lineCount >= thresholds.small && currentLevel < 1) return 'font-small';
  return null;
}

export function missingFontClass(content: string, config: MissingFontClassConfig = {}): LintError[] {
  const mergedConfig = mergeConfig(config);
  if (!mergedConfig.enabled) return [];

  const { slides } = parseSlides(content);
  const errors: LintError[] = [];

  for (const slide of slides) {
    if (slide.hasFrontmatter && slide.slideNumber === 1) continue;

    const lineCount = countContentLines(slide);
    const suggested = getSuggestedFontClass(lineCount, getFontClassLevel(slide), mergedConfig.thresholds);

    if (suggested) {
      errors.push({
        ruleId: 'marp/missing-font-class',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has ${lineCount} lines. Consider using "${suggested}" class.`,
        severity: 'warning'
      });
    }
  }

  return errors;
}
