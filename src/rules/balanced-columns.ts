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

interface ColumnInfo {
  leftCount: number;
  rightCount: number;
  imbalance: number;
}

/** Check if slide has columns layout */
function hasColumns(lines: string[]): boolean {
  return lines.some((line) => line.includes('class="columns"') || line.includes("class='columns'"));
}

/** Calculate column imbalance */
function getColumnInfo(leftCount: number, rightCount: number): ColumnInfo {
  const imbalance = Math.abs(leftCount - rightCount) / Math.max(leftCount, rightCount, 1);
  return { leftCount, rightCount, imbalance };
}

/** Report imbalance error */
function reportImbalance(
  slide: { slideNumber: number; startLine: number },
  info: ColumnInfo,
  errors: LintError[]
): void {
  const shorter = info.leftCount < info.rightCount ? 'left' : 'right';
  const longer = info.leftCount < info.rightCount ? 'right' : 'left';
  errors.push({
    ruleId: 'marp/balanced-columns',
    slideNumber: slide.slideNumber,
    lineNumber: slide.startLine,
    message: `Slide ${slide.slideNumber} has unbalanced columns: ${shorter} has ${Math.min(info.leftCount, info.rightCount)} lines, ${longer} has ${Math.max(info.leftCount, info.rightCount)} lines (${Math.round(info.imbalance * 100)}% imbalance)`,
    severity: 'warning'
  });
}

/** Report short column error */
function reportShortColumn(
  slide: { slideNumber: number; startLine: number },
  side: 'left' | 'right',
  count: number,
  errors: LintError[]
): void {
  errors.push({
    ruleId: 'marp/balanced-columns',
    slideNumber: slide.slideNumber,
    lineNumber: slide.startLine,
    message: `Slide ${slide.slideNumber} has a very short ${side} column (${count} lines). Consider restructuring.`,
    severity: 'warning'
  });
}

export function balancedColumns(content: string, config: BalancedColumnsConfig = {}): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  if (!mergedConfig.enabled) return [];

  const { slides } = parseSlides(content);
  const errors: LintError[] = [];

  for (const slide of slides) {
    if (!hasColumns(slide.lines)) continue;

    const columns = findColumns(slide);
    if (!columns) continue;

    const info = getColumnInfo(columns.left.length, columns.right.length);
    const total = info.leftCount + info.rightCount;

    if (total < mergedConfig.minColumnLines * 2) continue;

    if (info.imbalance > mergedConfig.maxImbalance) {
      reportImbalance(slide, info, errors);
    }

    const minLines = mergedConfig.minColumnLines;
    if (info.leftCount < minLines && info.rightCount >= minLines * 2) {
      reportShortColumn(slide, 'left', info.leftCount, errors);
    }
    if (info.rightCount < minLines && info.leftCount >= minLines * 2) {
      reportShortColumn(slide, 'right', info.rightCount, errors);
    }
  }

  return errors;
}
