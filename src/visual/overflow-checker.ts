/**
 * Visual overflow checker using Playwright
 * Renders slides and detects actual pixel overflow
 */

import type { Page } from 'playwright';
import type { LintError } from '../rules/slide-line-count.js';
import { type BaseVisualConfig, BaseVisualRule } from './base-visual-rule.js';

export interface OverflowCheckerConfig extends BaseVisualConfig {
  threshold?: number; // Minimum overflow in pixels to report
}

export interface OverflowResult {
  slideNumber: number;
  hasOverflow: boolean;
  hasVerticalOverflow: boolean;
  hasHorizontalOverflow: boolean;
  overflowHeight: number;
  overflowWidth: number;
  scrollHeight: number;
  clientHeight: number;
  preview: string;
  dataClass?: string;
}

const DEFAULT_CONFIG: Required<OverflowCheckerConfig> = {
  enabled: true,
  threshold: 10,
  viewport: {
    width: 1280,
    height: 720
  }
};

class OverflowCheckerRule extends BaseVisualRule<OverflowCheckerConfig, OverflowResult> {
  protected readonly tmpPrefix = 'overflow';
  protected readonly defaultConfig = DEFAULT_CONFIG;

  protected async analyze(page: Page): Promise<OverflowResult[]> {
    return (await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));
      return sections.map((section, index): OverflowResult => {
        const scrollHeight = section.scrollHeight;
        const clientHeight = section.clientHeight;
        const scrollWidth = section.scrollWidth;
        const clientWidth = section.clientWidth;
        const dataClass = section.getAttribute('data-class') || '';
        const textContent = section.textContent?.trim().substring(0, 50).replace(/\n/g, ' ') || '';

        const hasVerticalOverflow = scrollHeight > clientHeight;
        const hasHorizontalOverflow = scrollWidth > clientWidth;

        return {
          slideNumber: index + 1,
          hasOverflow: hasVerticalOverflow || hasHorizontalOverflow,
          hasVerticalOverflow,
          hasHorizontalOverflow,
          overflowHeight: scrollHeight - clientHeight,
          overflowWidth: scrollWidth - clientWidth,
          scrollHeight,
          clientHeight,
          preview: textContent,
          dataClass: dataClass || undefined
        };
      });
    })) as OverflowResult[];
  }

  protected convertToErrors(results: OverflowResult[], config: Required<OverflowCheckerConfig>): LintError[] {
    const errors: LintError[] = [];

    for (const result of results) {
      if (result.hasVerticalOverflow && result.overflowHeight > config.threshold) {
        errors.push({
          ruleId: 'marp/overflow',
          slideNumber: result.slideNumber,
          lineNumber: 0,
          message: `Slide ${result.slideNumber} has vertical overflow of ${result.overflowHeight}px. Content exceeds slide height.`,
          severity: 'error'
        });
      }

      if (result.hasHorizontalOverflow && result.overflowWidth > config.threshold) {
        errors.push({
          ruleId: 'marp/overflow',
          slideNumber: result.slideNumber,
          lineNumber: 0,
          message: `Slide ${result.slideNumber} has horizontal overflow of ${result.overflowWidth}px. Content exceeds slide width.`,
          severity: 'error'
        });
      }
    }

    return errors;
  }
}

// Singleton instance
const overflowChecker = new OverflowCheckerRule();

/**
 * Check for overflow in a single markdown file
 */
export async function checkOverflow(
  markdownPath: string,
  config: OverflowCheckerConfig = {}
): Promise<{ errors: LintError[]; results: OverflowResult[] }> {
  return overflowChecker.check(markdownPath, config);
}
