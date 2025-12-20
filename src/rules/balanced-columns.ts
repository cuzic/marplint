/**
 * Rule: marp/balanced-columns
 * Checks if 2-column layouts are balanced
 */

import { findColumns, parseSlides } from '../utils/slide-parser.js';
import type { LintError } from './slide-line-count.js';

export interface BalancedColumnsConfig {
  enabled?: boolean;
  maxImbalance?: number; // Max allowed imbalance ratio (0.0 - 1.0)
  minColumnLines?: number; // Minimum lines in a column to be considered
}

const DEFAULT_CONFIG: Required<BalancedColumnsConfig> = {
  enabled: true,
  maxImbalance: 0.3,
  minColumnLines: 3
};

export function balancedColumns(content: string, config: BalancedColumnsConfig = {}): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const { slides } = parseSlides(content);
  const errors: LintError[] = [];

  for (const slide of slides) {
    // Check if slide has columns
    const hasColumnsDiv = slide.lines.some(
      (line) => line.includes('class="columns"') || line.includes("class='columns'")
    );

    if (!hasColumnsDiv) continue;

    // Parse column content
    const columns = findColumns(slide);
    if (!columns) continue;

    const leftCount = columns.left.length;
    const rightCount = columns.right.length;
    const total = leftCount + rightCount;

    if (total < mergedConfig.minColumnLines * 2) {
      continue; // Skip if both columns are very small
    }

    const imbalance = Math.abs(leftCount - rightCount) / Math.max(leftCount, rightCount, 1);

    if (imbalance > mergedConfig.maxImbalance) {
      const shorter = leftCount < rightCount ? 'left' : 'right';
      const longer = leftCount < rightCount ? 'right' : 'left';
      errors.push({
        ruleId: 'marp/balanced-columns',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has unbalanced columns: ${shorter} has ${Math.min(leftCount, rightCount)} lines, ${longer} has ${Math.max(leftCount, rightCount)} lines (${Math.round(imbalance * 100)}% imbalance)`,
        severity: 'warning'
      });
    }

    // Check for very short column
    if (leftCount < mergedConfig.minColumnLines && rightCount >= mergedConfig.minColumnLines * 2) {
      errors.push({
        ruleId: 'marp/balanced-columns',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has a very short left column (${leftCount} lines). Consider restructuring.`,
        severity: 'warning'
      });
    }

    if (rightCount < mergedConfig.minColumnLines && leftCount >= mergedConfig.minColumnLines * 2) {
      errors.push({
        ruleId: 'marp/balanced-columns',
        slideNumber: slide.slideNumber,
        lineNumber: slide.startLine,
        message: `Slide ${slide.slideNumber} has a very short right column (${rightCount} lines). Consider restructuring.`,
        severity: 'warning'
      });
    }
  }

  return errors;
}
