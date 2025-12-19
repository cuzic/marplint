/**
 * Visual whitespace checker using Playwright
 * Detects slides with excessive unused space
 */

import type { Page } from 'playwright';
import { BaseVisualRule, type BaseVisualConfig } from './base-visual-rule.js';
import type { LintError } from '../rules/slide-line-count.js';

export interface WhitespaceCheckerConfig extends BaseVisualConfig {
  minUtilization?: number; // Minimum content utilization (0.0 - 1.0)
}

export interface WhitespaceResult {
  slideNumber: number;
  utilization: number; // 0.0 - 1.0
  scrollHeight: number;
  clientHeight: number;
  isSparse: boolean;
  preview: string;
  dataClass?: string;
}

const DEFAULT_CONFIG: Required<WhitespaceCheckerConfig> = {
  enabled: true,
  minUtilization: 0.4,
  viewport: {
    width: 1280,
    height: 720
  }
};

class WhitespaceCheckerRule extends BaseVisualRule<WhitespaceCheckerConfig, WhitespaceResult> {
  protected readonly tmpPrefix = 'ws';
  protected readonly defaultConfig = DEFAULT_CONFIG;

  protected async analyze(page: Page): Promise<WhitespaceResult[]> {
    return await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));
      return sections.map((section, index) => {
        const scrollHeight = section.scrollHeight;
        const clientHeight = section.clientHeight;
        const dataClass = section.getAttribute('data-class') || '';
        const textContent = section.textContent?.trim().substring(0, 50).replace(/\n/g, ' ') || '';

        // Calculate content utilization
        const utilization = scrollHeight / clientHeight;

        return {
          slideNumber: index + 1,
          utilization,
          scrollHeight,
          clientHeight,
          isSparse: utilization < 0.5, // Will be adjusted based on config
          preview: textContent,
          dataClass: dataClass || undefined
        };
      });
    }) as WhitespaceResult[];
  }

  protected convertToErrors(results: WhitespaceResult[], config: Required<WhitespaceCheckerConfig>): LintError[] {
    const errors: LintError[] = [];

    for (const result of results) {
      // Skip title/intro slides (usually sparse by design)
      if (result.slideNumber === 1) continue;

      // Update isSparse based on config
      result.isSparse = result.utilization < config.minUtilization;

      if (result.isSparse) {
        const utilizationPercent = Math.round(result.utilization * 100);
        errors.push({
          ruleId: 'marp/whitespace',
          slideNumber: result.slideNumber,
          lineNumber: 0,
          message: `Slide ${result.slideNumber} has low content utilization (${utilizationPercent}%). Consider adding more content or merging with another slide.`,
          severity: 'warning'
        });
      }
    }

    return errors;
  }
}

// Singleton instance
const whitespaceChecker = new WhitespaceCheckerRule();

/**
 * Check for excessive whitespace in slides
 */
export async function checkWhitespace(
  markdownPath: string,
  config: WhitespaceCheckerConfig = {}
): Promise<{ errors: LintError[]; results: WhitespaceResult[] }> {
  return whitespaceChecker.check(markdownPath, config);
}
