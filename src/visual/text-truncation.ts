/**
 * Visual rule: marp/text-truncation
 * Detects text that may be truncated or cut off
 */

import type { Page } from 'playwright';
import type { LintError } from '../rules/slide-line-count.js';
import { type BaseVisualConfig, BaseVisualRule } from './base-visual-rule.js';

export interface TextTruncationConfig extends BaseVisualConfig {}

export interface TextTruncationResult {
  slideNumber: number;
  truncatedElements: Array<{
    text: string;
    scrollWidth: number;
    clientWidth: number;
  }>;
}

const DEFAULT_CONFIG: Required<TextTruncationConfig> = {
  enabled: true,
  viewport: {
    width: 1280,
    height: 720
  }
};

class TextTruncationRule extends BaseVisualRule<TextTruncationConfig, TextTruncationResult> {
  protected readonly tmpPrefix = 'trunc';
  protected readonly defaultConfig = DEFAULT_CONFIG;

  protected async analyze(page: Page): Promise<TextTruncationResult[]> {
    return (await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));

      return sections.map((section, index) => {
        const truncatedElements: Array<{
          text: string;
          scrollWidth: number;
          clientWidth: number;
        }> = [];

        // Check text elements for horizontal overflow (truncation)
        const textElements = section.querySelectorAll('p, li, td, th, h1, h2, h3, h4, h5, h6, span');

        textElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const text = htmlEl.innerText?.trim().substring(0, 40) || '';
          if (!text) return;

          // Check for horizontal overflow
          if (htmlEl.scrollWidth > htmlEl.clientWidth + 5) {
            // 5px tolerance
            truncatedElements.push({
              text,
              scrollWidth: htmlEl.scrollWidth,
              clientWidth: htmlEl.clientWidth
            });
          }

          // Check for text-overflow: ellipsis being applied
          const style = window.getComputedStyle(htmlEl);
          if (style.textOverflow === 'ellipsis' && style.overflow === 'hidden') {
            if (htmlEl.scrollWidth > htmlEl.clientWidth) {
              truncatedElements.push({
                text,
                scrollWidth: htmlEl.scrollWidth,
                clientWidth: htmlEl.clientWidth
              });
            }
          }
        });

        return {
          slideNumber: index + 1,
          truncatedElements: truncatedElements.slice(0, 3)
        };
      });
    })) as TextTruncationResult[];
  }

  protected convertToErrors(results: TextTruncationResult[]): LintError[] {
    const errors: LintError[] = [];

    for (const result of results) {
      if (result.truncatedElements.length > 0) {
        const element = result.truncatedElements[0];
        if (element) {
          errors.push({
            ruleId: 'marp/text-truncation',
            slideNumber: result.slideNumber,
            lineNumber: 0,
            message: `Slide ${result.slideNumber}: Text may be truncated. "${element.text}..." exceeds container width.`,
            severity: 'warning'
          });
        }
      }
    }

    return errors;
  }
}

// Singleton instance
const textTruncationChecker = new TextTruncationRule();

/**
 * Check for text truncation in slides
 */
export async function checkTextTruncation(
  markdownPath: string,
  config: TextTruncationConfig = {}
): Promise<{ errors: LintError[]; results: TextTruncationResult[] }> {
  return textTruncationChecker.check(markdownPath, config);
}
