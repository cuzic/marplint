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

export function missingFontClass(content: string, config: MissingFontClassConfig = {}): LintError[] {
  const mergedConfig: ResolvedMissingFontClassConfig = {
    enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
    thresholds: {
      small: config.thresholds?.small ?? DEFAULT_CONFIG.thresholds.small,
      xsmall: config.thresholds?.xsmall ?? DEFAULT_CONFIG.thresholds.xsmall,
      xxsmall: config.thresholds?.xxsmall ?? DEFAULT_CONFIG.thresholds.xxsmall
    }
  };

  if (!mergedConfig.enabled) {
    return [];
  }

  const { slides } = parseSlides(content);
  const errors: LintError[] = [];

  for (const slide of slides) {
    // Skip first slide with frontmatter
    if (slide.hasFrontmatter && slide.slideNumber === 1) {
      continue;
    }

    const lineCount = countContentLines(slide);
    const currentFontLevel = getFontClassLevel(slide);

    // Check if slide needs a smaller font
    if (lineCount >= mergedConfig.thresholds.xxsmall && currentFontLevel < 3) {
      errors.push({
        ruleId: 'marp/missing-font-class',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has ${lineCount} lines. Consider using "font-xxsmall" class.`,
        severity: 'warning'
      });
    } else if (lineCount >= mergedConfig.thresholds.xsmall && currentFontLevel < 2) {
      errors.push({
        ruleId: 'marp/missing-font-class',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has ${lineCount} lines. Consider using "font-xsmall" class.`,
        severity: 'warning'
      });
    } else if (lineCount >= mergedConfig.thresholds.small && currentFontLevel < 1) {
      errors.push({
        ruleId: 'marp/missing-font-class',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has ${lineCount} lines. Consider using "font-small" class.`,
        severity: 'warning'
      });
    }
  }

  return errors;
}
