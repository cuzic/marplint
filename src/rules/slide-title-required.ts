/**
 * Rule: marp/slide-title-required
 * Ensures each slide has a title (heading)
 */

import type { LintError } from './slide-line-count.js';
import { visitSlides, type LineContext } from '../utils/slide-visitor.js';

export interface SlideTitleRequiredConfig {
  enabled?: boolean;
  allowedLevels?: number[]; // Which heading levels count as titles
  skipSlides?: number[]; // Slide numbers to skip (e.g., divider slides)
}

const DEFAULT_CONFIG: Required<SlideTitleRequiredConfig> = {
  enabled: true,
  allowedLevels: [1, 2, 3],
  skipSlides: []
};

export function slideTitleRequired(
  content: string,
  config: SlideTitleRequiredConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const errors: LintError[] = [];
  let hasTitle = false;
  let slideStartLine = 1;

  visitSlides(content, {
    onSlideStart(slideNumber: number, startLine: number) {
      hasTitle = false;
      slideStartLine = startLine;
    },

    onSlideEnd(slideNumber: number) {
      if (!hasTitle && !mergedConfig.skipSlides.includes(slideNumber)) {
        // Skip first slide (usually has frontmatter + title)
        if (slideNumber > 1) {
          errors.push({
            ruleId: 'marp/slide-title-required',
            slideNumber,
            lineNumber: slideStartLine,
            message: `Slide ${slideNumber}: No title heading found. Add a heading (H${mergedConfig.allowedLevels.join('/H')}).`,
            severity: 'warning'
          });
        }
      }
    },

    onHeading(level: number, _text: string, _context: LineContext) {
      if (mergedConfig.allowedLevels.includes(level)) {
        hasTitle = true;
      }
    }
  });

  return errors;
}
