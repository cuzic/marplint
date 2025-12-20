/**
 * Rule: marp/code-block-length
 * Checks code block length to prevent overflow
 */

import type { LintError } from './slide-line-count.js';
import { visitSlides, type LineContext } from '../utils/slide-visitor.js';

export interface CodeBlockLengthConfig {
  enabled?: boolean;
  maxLines?: number;
  maxLineLength?: number;
}

const DEFAULT_CONFIG: Required<CodeBlockLengthConfig> = {
  enabled: true,
  maxLines: 15,
  maxLineLength: 80
};

export function codeBlockLength(
  content: string,
  config: CodeBlockLengthConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const errors: LintError[] = [];

  visitSlides(content, {
    onCodeBlockEnd(lines: string[], language: string, startLine: number, context: LineContext) {
      // Check line count
      if (lines.length > mergedConfig.maxLines) {
        errors.push({
          ruleId: 'marp/code-block-length',
          slideNumber: context.slideNumber,
          lineNumber: startLine,
          message: `Slide ${context.slideNumber}: Code block has ${lines.length} lines (max: ${mergedConfig.maxLines}). Consider splitting or using a smaller font.`,
          severity: 'warning'
        });
      }

      // Check line length
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (line.length > mergedConfig.maxLineLength) {
          errors.push({
            ruleId: 'marp/code-block-length',
            slideNumber: context.slideNumber,
            lineNumber: startLine + i + 1,
            message: `Slide ${context.slideNumber}: Code line ${i + 1} has ${line.length} characters (max: ${mergedConfig.maxLineLength}). Line may be truncated.`,
            severity: 'warning'
          });
          break; // Only report first occurrence per block
        }
      }
    }
  });

  return errors;
}
