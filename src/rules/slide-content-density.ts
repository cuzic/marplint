/**
 * Rule: marp/slide-content-density
 * Checks content density (characters, list items) per slide
 */

import { parseSlides, countCharacters, countListItems } from '../utils/slide-parser.js';
import type { LintError } from './slide-line-count.js';

export interface SlideContentDensityConfig {
  enabled?: boolean;
  maxCharacters?: number;
  maxListItems?: number;
}

const DEFAULT_CONFIG: Required<SlideContentDensityConfig> = {
  enabled: true,
  maxCharacters: 800,
  maxListItems: 15
};

export function slideContentDensity(
  content: string,
  config: SlideContentDensityConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

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

    const charCount = countCharacters(slide);
    const listCount = countListItems(slide);

    if (charCount > mergedConfig.maxCharacters) {
      errors.push({
        ruleId: 'marp/slide-content-density',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has ${charCount} characters (max: ${mergedConfig.maxCharacters}). Consider reducing text or splitting the slide.`,
        severity: 'warning'
      });
    }

    if (listCount > mergedConfig.maxListItems) {
      errors.push({
        ruleId: 'marp/slide-content-density',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has ${listCount} list items (max: ${mergedConfig.maxListItems}). Consider using columns or splitting the slide.`,
        severity: 'warning'
      });
    }
  }

  return errors;
}
