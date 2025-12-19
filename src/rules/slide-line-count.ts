/**
 * Rule: marp/slide-line-count
 * Checks the number of content lines per slide
 */

import { parseSlides, countContentLines, type Slide } from '../utils/slide-parser.js';

export interface SlideLineCountConfig {
  enabled?: boolean;
  maxLines?: number;
  minLines?: number;
  ignoreCodeBlocks?: boolean;
}

export interface LintError {
  ruleId: string;
  slideNumber: number;
  lineNumber: number;
  message: string;
  severity: 'error' | 'warning';
}

const DEFAULT_CONFIG: Required<SlideLineCountConfig> = {
  enabled: true,
  maxLines: 30,
  minLines: 5,
  ignoreCodeBlocks: false
};

export function slideLineCount(
  content: string,
  config: SlideLineCountConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const { slides } = parseSlides(content);
  const errors: LintError[] = [];

  for (const slide of slides) {
    // Skip the first slide if it's mostly frontmatter
    if (slide.hasFrontmatter && slide.slideNumber === 1) {
      continue;
    }

    const lineCount = countContentLines(slide);

    if (lineCount > mergedConfig.maxLines) {
      errors.push({
        ruleId: 'marp/slide-line-count',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has ${lineCount} content lines (max: ${mergedConfig.maxLines}). Consider splitting the slide or using smaller font.`,
        severity: 'error'
      });
    }

    if (lineCount < mergedConfig.minLines && lineCount > 0) {
      errors.push({
        ruleId: 'marp/slide-line-count',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has only ${lineCount} content lines (min: ${mergedConfig.minLines}). Consider adding more content or merging with another slide.`,
        severity: 'warning'
      });
    }
  }

  return errors;
}
