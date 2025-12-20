/**
 * Rule: marp/html-blank-lines
 * Ensures blank lines between HTML tags and Markdown content
 */

import type { LintError } from './slide-line-count.js';

export interface HtmlBlankLinesConfig {
  enabled?: boolean;
}

const HTML_OPEN_TAGS = ['<div', '<span', '<table', '<tr', '<td', '<th'];
const HTML_CLOSE_TAGS = ['</div>', '</span>', '</table>', '</tr>', '</td>', '</th>'];
const MARKDOWN_PATTERNS = [
  /^#+\s/, // Headers
  /^[-*+]\s/, // Unordered lists
  /^\d+\.\s/, // Ordered lists
  /^\|/, // Tables
  /^>/, // Blockquotes
  /^```/, // Code blocks
  /^\*\*|^__/ // Bold text at start
];

/** Check for HTML opening tag followed by Markdown */
function checkHtmlOpeningTag(
  trimmed: string,
  nextLine: string,
  lineNumber: number,
  currentSlide: number,
  errors: LintError[]
): void {
  if (!isHtmlOpenTag(trimmed)) return;
  if (nextLine && isMarkdownContent(nextLine) && !isHtmlTag(nextLine)) {
    errors.push({
      ruleId: 'marp/html-blank-lines',
      slideNumber: currentSlide,
      lineNumber: lineNumber + 1,
      message: `Missing blank line after HTML tag "${trimmed.substring(0, 30)}..." before Markdown content`,
      severity: 'error'
    });
  }
}

/** Check for Markdown followed by HTML closing tag */
function checkMarkdownBeforeClosingTag(
  trimmed: string,
  nextLine: string,
  lineNumber: number,
  currentSlide: number,
  errors: LintError[]
): void {
  if (!isMarkdownContent(trimmed) || isHtmlTag(trimmed)) return;
  if (isHtmlCloseTag(nextLine)) {
    errors.push({
      ruleId: 'marp/html-blank-lines',
      slideNumber: currentSlide,
      lineNumber: lineNumber,
      message: `Missing blank line before closing HTML tag "${nextLine}" after Markdown content`,
      severity: 'error'
    });
  }
}

export function htmlBlankLines(content: string, config: HtmlBlankLinesConfig = {}): LintError[] {
  if (config.enabled === false) return [];

  const lines = content.split('\n');
  const errors: LintError[] = [];
  let currentSlide = 1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    const lineNumber = i + 1;

    if (trimmed === '---' && i > 0) {
      currentSlide++;
      continue;
    }

    const nextLine = lines[i + 1]?.trim() ?? '';
    checkHtmlOpeningTag(trimmed, nextLine, lineNumber, currentSlide, errors);
    checkMarkdownBeforeClosingTag(trimmed, nextLine, lineNumber, currentSlide, errors);
  }

  return errors;
}

function isHtmlOpenTag(line: string): boolean {
  return HTML_OPEN_TAGS.some((tag) => line.startsWith(tag));
}

function isHtmlCloseTag(line: string): boolean {
  return HTML_CLOSE_TAGS.some((tag) => line.startsWith(tag));
}

function isHtmlTag(line: string): boolean {
  return line.startsWith('<') || line.startsWith('<!--');
}

function isMarkdownContent(line: string): boolean {
  if (!line || line.startsWith('<') || line.startsWith('<!--')) {
    return false;
  }
  // Check if it's markdown-like content
  return MARKDOWN_PATTERNS.some((pattern) => pattern.test(line)) || (line.length > 0 && !line.startsWith('<'));
}
