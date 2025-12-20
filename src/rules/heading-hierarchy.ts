/**
 * Rule: marp/heading-hierarchy
 * Ensures proper heading hierarchy (h1 → h2 → h3 → h4, no skipping levels)
 */

import { type LineContext, visitSlides } from '../utils/slide-visitor.js';
import type { LintError } from './slide-line-count.js';

export interface HeadingHierarchyConfig {
  enabled?: boolean;
  allowH1InSlides?: boolean; // Allow h1 in slides (not just title slide)
}

const DEFAULT_CONFIG: Required<HeadingHierarchyConfig> = {
  enabled: true,
  allowH1InSlides: false
};

interface Heading {
  level: number;
  lineNumber: number;
  text: string;
  slideNumber: number;
}

export function headingHierarchy(content: string, config: HeadingHierarchyConfig = {}): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const errors: LintError[] = [];
  let headingsInSlide: Heading[] = [];
  let _currentSlide = 0;

  visitSlides(content, {
    onSlideStart(slideNumber: number) {
      _currentSlide = slideNumber;
      headingsInSlide = [];
    },

    onSlideEnd(slideNumber: number) {
      validateSlideHeadings(headingsInSlide, errors, slideNumber, mergedConfig);
    },

    onHeading(level: number, text: string, context: LineContext) {
      headingsInSlide.push({
        level,
        lineNumber: context.lineNumber,
        text,
        slideNumber: context.slideNumber
      });
    }
  });

  return errors;
}

function validateSlideHeadings(
  headings: Heading[],
  errors: LintError[],
  slideNumber: number,
  config: Required<HeadingHierarchyConfig>
): void {
  if (headings.length === 0) return;

  // Check for h1 in non-title slides
  if (!config.allowH1InSlides && slideNumber > 1) {
    for (const heading of headings) {
      if (heading.level === 1) {
        errors.push({
          ruleId: 'marp/heading-hierarchy',
          slideNumber,
          lineNumber: heading.lineNumber,
          message: `Slide ${slideNumber}: H1 should only be used on the title slide. Use H2 instead.`,
          severity: 'warning'
        });
      }
    }
  }

  // Check heading level jumps
  let previousLevel = 0;
  for (const heading of headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      errors.push({
        ruleId: 'marp/heading-hierarchy',
        slideNumber,
        lineNumber: heading.lineNumber,
        message: `Slide ${slideNumber}: Heading level jumped from H${previousLevel} to H${heading.level}. Don't skip levels.`,
        severity: 'warning'
      });
    }
    previousLevel = heading.level;
  }
}
