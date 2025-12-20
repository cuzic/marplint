/**
 * Rule: marp/max-nested-list
 * Limits nesting depth of lists to improve readability
 */

import { type LineContext, visitSlides } from '../utils/slide-visitor.js';
import type { LintError } from './slide-line-count.js';

export interface MaxNestedListConfig {
  enabled?: boolean;
  maxDepth?: number;
}

const DEFAULT_CONFIG: Required<MaxNestedListConfig> = {
  enabled: true,
  maxDepth: 3
};

export function maxNestedList(content: string, config: MaxNestedListConfig = {}): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const errors: LintError[] = [];
  const reportedSlides = new Set<number>();

  visitSlides(content, {
    onListItem(_text: string, depth: number, _ordered: boolean, context: LineContext) {
      if (depth > mergedConfig.maxDepth && !reportedSlides.has(context.slideNumber)) {
        reportedSlides.add(context.slideNumber);
        errors.push({
          ruleId: 'marp/max-nested-list',
          slideNumber: context.slideNumber,
          lineNumber: context.lineNumber,
          message: `Slide ${context.slideNumber}: List nesting depth is ${depth} (max: ${mergedConfig.maxDepth}). Deep nesting reduces readability.`,
          severity: 'warning'
        });
      }
    }
  });

  return errors;
}
