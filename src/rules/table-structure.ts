/**
 * Rule: marp/table-structure
 * Validates table structure and formatting
 */

import type { LintError } from './slide-line-count.js';
import { visitSlides, type LineContext } from '../utils/slide-visitor.js';

export interface TableStructureConfig {
  enabled?: boolean;
  maxColumns?: number;
  maxRows?: number;
  requireHeader?: boolean;
  checkAlignment?: boolean;
}

const DEFAULT_CONFIG: Required<TableStructureConfig> = {
  enabled: true,
  maxColumns: 6,
  maxRows: 10,
  requireHeader: true,
  checkAlignment: true
};

interface Table {
  startLine: number;
  rows: string[][];
  hasHeader: boolean;
  alignments: string[];
  slideNumber: number;
}

export function tableStructure(
  content: string,
  config: TableStructureConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const errors: LintError[] = [];

  // Track table parsing state
  let inTable = false;
  let tableStartLine = 0;
  let tableRows: string[][] = [];
  let hasHeader = false;
  let alignments: string[] = [];
  let currentTableSlide = 0;

  const finalizeTable = () => {
    if (inTable && tableRows.length > 0) {
      validateTable({
        startLine: tableStartLine,
        rows: tableRows,
        hasHeader,
        alignments,
        slideNumber: currentTableSlide
      }, errors, mergedConfig);
    }
    inTable = false;
    tableRows = [];
    hasHeader = false;
    alignments = [];
  };

  visitSlides(content, {
    onSlideEnd() {
      finalizeTable();
    },

    onLine(line: string, context: LineContext) {
      const trimmedLine = line.trim();
      const isTableRow = trimmedLine.startsWith('|') && trimmedLine.endsWith('|');
      const isSeparator = /^\|[\s\-:|]+\|$/.test(trimmedLine);

      if (isTableRow || isSeparator) {
        if (!inTable) {
          inTable = true;
          tableStartLine = context.lineNumber;
          tableRows = [];
          hasHeader = false;
          alignments = [];
          currentTableSlide = context.slideNumber;
        }

        if (isSeparator) {
          hasHeader = true;
          alignments = parseAlignments(line);
        } else {
          const cells = parseTableRow(line);
          tableRows.push(cells);
        }
      } else if (inTable) {
        finalizeTable();
      }
    }
  });

  // Handle table at end of file
  finalizeTable();

  return errors;
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map(cell => cell.trim());
}

function parseAlignments(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map(cell => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
      if (trimmed.endsWith(':')) return 'right';
      if (trimmed.startsWith(':')) return 'left';
      return 'default';
    });
}

function validateTable(
  table: Table,
  errors: LintError[],
  config: Required<TableStructureConfig>
): void {
  if (table.rows.length === 0) return;

  const columnCount = table.rows[0]?.length ?? 0;

  // Check column count
  if (columnCount > config.maxColumns) {
    errors.push({
      ruleId: 'marp/table-structure',
      slideNumber: table.slideNumber,
      lineNumber: table.startLine,
      message: `Slide ${table.slideNumber}: Table has ${columnCount} columns (max: ${config.maxColumns}). Consider simplifying.`,
      severity: 'warning'
    });
  }

  // Check row count
  if (table.rows.length > config.maxRows) {
    errors.push({
      ruleId: 'marp/table-structure',
      slideNumber: table.slideNumber,
      lineNumber: table.startLine,
      message: `Slide ${table.slideNumber}: Table has ${table.rows.length} rows (max: ${config.maxRows}). Consider splitting.`,
      severity: 'warning'
    });
  }

  // Check header requirement
  if (config.requireHeader && !table.hasHeader) {
    errors.push({
      ruleId: 'marp/table-structure',
      slideNumber: table.slideNumber,
      lineNumber: table.startLine,
      message: `Slide ${table.slideNumber}: Table is missing header separator row (|---|---|).`,
      severity: 'warning'
    });
  }

  // Check column consistency
  for (let i = 1; i < table.rows.length; i++) {
    const rowCols = table.rows[i]?.length ?? 0;
    if (rowCols !== columnCount) {
      errors.push({
        ruleId: 'marp/table-structure',
        slideNumber: table.slideNumber,
        lineNumber: table.startLine + i,
        message: `Slide ${table.slideNumber}: Table row ${i + 1} has ${rowCols} columns, expected ${columnCount}.`,
        severity: 'error'
      });
    }
  }
}
