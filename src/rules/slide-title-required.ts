/**
 * Rule: marp/slide-title-required
 * Ensures each slide has a title (heading)
 */

import type { LintError } from './slide-line-count.js';

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

  const lines = content.split('\n');
  const errors: LintError[] = [];
  let currentSlide = 1;
  let slideStartLine = 1;
  let inFrontmatter = false;
  let inCodeBlock = false;
  let hasTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNumber = i + 1;

    // Track frontmatter
    if (line.trim() === '---') {
      if (i === 0) {
        inFrontmatter = true;
        continue;
      } else if (inFrontmatter) {
        inFrontmatter = false;
        continue;
      } else {
        // End of slide - check if it had a title
        if (!hasTitle && !mergedConfig.skipSlides.includes(currentSlide)) {
          // Skip first slide (usually has frontmatter + title)
          if (currentSlide > 1) {
            errors.push({
              ruleId: 'marp/slide-title-required',
              slideNumber: currentSlide,
              lineNumber: slideStartLine,
              message: `Slide ${currentSlide}: No title heading found. Add a heading (H${mergedConfig.allowedLevels.join('/H')}).`,
              severity: 'warning'
            });
          }
        }

        currentSlide++;
        slideStartLine = lineNumber + 1;
        hasTitle = false;
        continue;
      }
    }

    if (inFrontmatter) continue;

    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Check for headings
    const headingMatch = line.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 0;
      if (mergedConfig.allowedLevels.includes(level)) {
        hasTitle = true;
      }
    }
  }

  // Check last slide
  if (!hasTitle && !mergedConfig.skipSlides.includes(currentSlide) && currentSlide > 1) {
    errors.push({
      ruleId: 'marp/slide-title-required',
      slideNumber: currentSlide,
      lineNumber: slideStartLine,
      message: `Slide ${currentSlide}: No title heading found. Add a heading (H${mergedConfig.allowedLevels.join('/H')}).`,
      severity: 'warning'
    });
  }

  return errors;
}
