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
import { type BalancedColumnsConfig, balancedColumns } from './balanced-columns.js';
import { type CodeBlockLengthConfig, codeBlockLength } from './code-block-length.js';
import { type DuplicateContentConfig, duplicateContent } from './duplicate-content.js';
import { type HeadingHierarchyConfig, headingHierarchy } from './heading-hierarchy.js';
import { type HtmlBlankLinesConfig, htmlBlankLines } from './html-blank-lines.js';
import { type JapaneseConsistencyConfig, japaneseConsistency } from './japanese-consistency.js';
import { type LinkValidityConfig, linkValidity } from './link-validity.js';
import { type MaxNestedListConfig, maxNestedList } from './max-nested-list.js';
import { type MissingFontClassConfig, missingFontClass } from './missing-font-class.js';
import { type SlideContentDensityConfig, slideContentDensity } from './slide-content-density.js';
import { type LintError, type SlideLineCountConfig, slideLineCount } from './slide-line-count.js';
import { type SlideTitleRequiredConfig, slideTitleRequired } from './slide-title-required.js';
import { type TableStructureConfig, tableStructure } from './table-structure.js';

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
  if (ruleConfig === false || ruleConfig == null) {
    return undefined;
  }
  if (typeof ruleConfig === 'object' && ruleConfig !== null) {
    return ruleConfig as T;
  }
  return {} as T;
}

/**
 * Run all static rules on content
 */
export function runStaticRules(content: string, filePath: string, config: MarplintConfig): StaticLintResult {
  const allErrors: LintError[] = [];

  // Original rules
  const lineCountConfig = getRuleConfig<SlideLineCountConfig>(config, 'marp/slide-line-count');
  if (lineCountConfig !== undefined) {
    allErrors.push(...slideLineCount(content, lineCountConfig));
  }

  const densityConfig = getRuleConfig<SlideContentDensityConfig>(config, 'marp/slide-content-density');
  if (densityConfig !== undefined) {
    allErrors.push(...slideContentDensity(content, densityConfig));
  }

  const blankLinesConfig = getRuleConfig<HtmlBlankLinesConfig>(config, 'marp/html-blank-lines');
  if (blankLinesConfig !== undefined) {
    allErrors.push(...htmlBlankLines(content, blankLinesConfig));
  }

  const fontClassConfig = getRuleConfig<MissingFontClassConfig>(config, 'marp/missing-font-class');
  if (fontClassConfig !== undefined) {
    allErrors.push(...missingFontClass(content, fontClassConfig));
  }

  const columnsConfig = getRuleConfig<BalancedColumnsConfig>(config, 'marp/balanced-columns');
  if (columnsConfig !== undefined) {
    allErrors.push(...balancedColumns(content, columnsConfig));
  }

  // New rules
  const hierarchyConfig = getRuleConfig<HeadingHierarchyConfig>(config, 'marp/heading-hierarchy');
  if (hierarchyConfig !== undefined) {
    allErrors.push(...headingHierarchy(content, hierarchyConfig));
  }

  const codeBlockConfig = getRuleConfig<CodeBlockLengthConfig>(config, 'marp/code-block-length');
  if (codeBlockConfig !== undefined) {
    allErrors.push(...codeBlockLength(content, codeBlockConfig));
  }

  const linkConfig = getRuleConfig<LinkValidityConfig>(config, 'marp/link-validity');
  if (linkConfig !== undefined) {
    allErrors.push(...linkValidity(content, filePath, linkConfig));
  }

  const japaneseConfig = getRuleConfig<JapaneseConsistencyConfig>(config, 'marp/japanese-consistency');
  if (japaneseConfig !== undefined) {
    allErrors.push(...japaneseConsistency(content, japaneseConfig));
  }

  const titleConfig = getRuleConfig<SlideTitleRequiredConfig>(config, 'marp/slide-title-required');
  if (titleConfig !== undefined) {
    allErrors.push(...slideTitleRequired(content, titleConfig));
  }

  const tableConfig = getRuleConfig<TableStructureConfig>(config, 'marp/table-structure');
  if (tableConfig !== undefined) {
    allErrors.push(...tableStructure(content, tableConfig));
  }

  const duplicateConfig = getRuleConfig<DuplicateContentConfig>(config, 'marp/duplicate-content');
  if (duplicateConfig !== undefined) {
    allErrors.push(...duplicateContent(content, duplicateConfig));
  }

  const nestedListConfig = getRuleConfig<MaxNestedListConfig>(config, 'marp/max-nested-list');
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
