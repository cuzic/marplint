/**
 * Static rules for marplint
 */

export { type BalancedColumnsConfig, balancedColumns } from './balanced-columns.js';
export { type CodeBlockLengthConfig, codeBlockLength } from './code-block-length.js';
export { type DuplicateContentConfig, duplicateContent } from './duplicate-content.js';
// New rules
export { type HeadingHierarchyConfig, headingHierarchy } from './heading-hierarchy.js';
export { type HtmlBlankLinesConfig, htmlBlankLines } from './html-blank-lines.js';
export { type JapaneseConsistencyConfig, japaneseConsistency } from './japanese-consistency.js';
export { type LinkValidityConfig, linkValidity } from './link-validity.js';
export { type MaxNestedListConfig, maxNestedList } from './max-nested-list.js';
export { type MissingFontClassConfig, missingFontClass } from './missing-font-class.js';
export { type SlideContentDensityConfig, slideContentDensity } from './slide-content-density.js';
// Original rules
export { type LintError, type SlideLineCountConfig, slideLineCount } from './slide-line-count.js';
export { type SlideTitleRequiredConfig, slideTitleRequired } from './slide-title-required.js';
export { type TableStructureConfig, tableStructure } from './table-structure.js';

import type { MarplintConfig } from '../utils/config.js';
import { balancedColumns } from './balanced-columns.js';
import { codeBlockLength } from './code-block-length.js';
import { duplicateContent } from './duplicate-content.js';
import { headingHierarchy } from './heading-hierarchy.js';
import { htmlBlankLines } from './html-blank-lines.js';
import { japaneseConsistency } from './japanese-consistency.js';
import { linkValidity } from './link-validity.js';
import { maxNestedList } from './max-nested-list.js';
import { missingFontClass } from './missing-font-class.js';
import { slideContentDensity } from './slide-content-density.js';
import type { LintError } from './slide-line-count.js';
// Imports
import { slideLineCount } from './slide-line-count.js';
import { slideTitleRequired } from './slide-title-required.js';
import { tableStructure } from './table-structure.js';

export interface StaticLintResult {
  errors: LintError[];
  warnings: LintError[];
  fileInfo: {
    path: string;
    slideCount: number;
  };
}

/**
 * Helper to get rule config
 */
function getRuleConfig<T>(config: MarplintConfig, ruleName: string): T | undefined {
  const ruleConfig = (config.rules as Record<string, unknown>)[ruleName];
  if (ruleConfig === false) return undefined;
  if (typeof ruleConfig === 'object') return ruleConfig as T;
  return {} as T;
}

/**
 * Run all static rules on content
 */
export function runStaticRules(content: string, filePath: string, config: MarplintConfig): StaticLintResult {
  const allErrors: LintError[] = [];

  // Original rules
  const lineCountConfig = getRuleConfig(config, 'marp/slide-line-count');
  if (lineCountConfig !== undefined) {
    allErrors.push(...slideLineCount(content, lineCountConfig));
  }

  const densityConfig = getRuleConfig(config, 'marp/slide-content-density');
  if (densityConfig !== undefined) {
    allErrors.push(...slideContentDensity(content, densityConfig));
  }

  const blankLinesConfig = getRuleConfig(config, 'marp/html-blank-lines');
  if (blankLinesConfig !== undefined) {
    allErrors.push(...htmlBlankLines(content, blankLinesConfig));
  }

  const fontClassConfig = getRuleConfig(config, 'marp/missing-font-class');
  if (fontClassConfig !== undefined) {
    allErrors.push(...missingFontClass(content, fontClassConfig));
  }

  const columnsConfig = getRuleConfig(config, 'marp/balanced-columns');
  if (columnsConfig !== undefined) {
    allErrors.push(...balancedColumns(content, columnsConfig));
  }

  // New rules
  const hierarchyConfig = getRuleConfig(config, 'marp/heading-hierarchy');
  if (hierarchyConfig !== undefined) {
    allErrors.push(...headingHierarchy(content, hierarchyConfig));
  }

  const codeBlockConfig = getRuleConfig(config, 'marp/code-block-length');
  if (codeBlockConfig !== undefined) {
    allErrors.push(...codeBlockLength(content, codeBlockConfig));
  }

  const linkConfig = getRuleConfig(config, 'marp/link-validity');
  if (linkConfig !== undefined) {
    allErrors.push(...linkValidity(content, filePath, linkConfig));
  }

  const japaneseConfig = getRuleConfig(config, 'marp/japanese-consistency');
  if (japaneseConfig !== undefined) {
    allErrors.push(...japaneseConsistency(content, japaneseConfig));
  }

  const titleConfig = getRuleConfig(config, 'marp/slide-title-required');
  if (titleConfig !== undefined) {
    allErrors.push(...slideTitleRequired(content, titleConfig));
  }

  const tableConfig = getRuleConfig(config, 'marp/table-structure');
  if (tableConfig !== undefined) {
    allErrors.push(...tableStructure(content, tableConfig));
  }

  const duplicateConfig = getRuleConfig(config, 'marp/duplicate-content');
  if (duplicateConfig !== undefined) {
    allErrors.push(...duplicateContent(content, duplicateConfig));
  }

  const nestedListConfig = getRuleConfig(config, 'marp/max-nested-list');
  if (nestedListConfig !== undefined) {
    allErrors.push(...maxNestedList(content, nestedListConfig));
  }

  // Count slides
  const slideCount = (content.match(/\n---\n/g) || []).length + 1;

  return {
    errors: allErrors.filter((e) => e.severity === 'error'),
    warnings: allErrors.filter((e) => e.severity === 'warning'),
    fileInfo: {
      path: filePath,
      slideCount
    }
  };
}
