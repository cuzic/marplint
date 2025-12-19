/**
 * Rule: marp/max-nested-list
 * Limits nesting depth of lists to improve readability
 */

import type { LintError } from './slide-line-count.js';

export interface MaxNestedListConfig {
  enabled?: boolean;
  maxDepth?: number;
}

const DEFAULT_CONFIG: Required<MaxNestedListConfig> = {
  enabled: true,
  maxDepth: 3
};

export function maxNestedList(
  content: string,
  config: MaxNestedListConfig = {}
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
  const reportedSlides = new Set<number>();

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

    // Check list item
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s/);
    if (listMatch) {
      const indent = listMatch[1]?.length ?? 0;
      // Assume 2 spaces or 1 tab per level
      const depth = Math.floor(indent / 2) + 1;

      if (depth > mergedConfig.maxDepth && !reportedSlides.has(currentSlide)) {
        reportedSlides.add(currentSlide);
        errors.push({
          ruleId: 'marp/max-nested-list',
          slideNumber: currentSlide,
          lineNumber,
          message: `Slide ${currentSlide}: List nesting depth is ${depth} (max: ${mergedConfig.maxDepth}). Deep nesting reduces readability.`,
          severity: 'warning'
        });
      }
    }
  }

  return errors;
}
