/**
 * Rule: marp/heading-hierarchy
 * Ensures proper heading hierarchy (h1 → h2 → h3 → h4, no skipping levels)
 */

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

export function headingHierarchy(
  content: string,
  config: HeadingHierarchyConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const lines = content.split('\n');
  const errors: LintError[] = [];
  let currentSlide = 1;
  let inFrontmatter = false;
  let inCodeBlock = false;

  const headingsInSlide: Heading[] = [];

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
        // Slide break - validate headings in previous slide
        validateSlideHeadings(headingsInSlide, errors, currentSlide, mergedConfig);
        headingsInSlide.length = 0;
        currentSlide++;
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

    // Detect headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 0;
      const text = headingMatch[2] ?? '';
      headingsInSlide.push({ level, lineNumber, text, slideNumber: currentSlide });
    }
  }

  // Validate last slide
  validateSlideHeadings(headingsInSlide, errors, currentSlide, mergedConfig);

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
