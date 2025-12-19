/**
 * Rule: marp/link-validity
 * Validates links in slides (broken links, missing anchors)
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import type { LintError } from './slide-line-count.js';
import { visitSlides, type LineContext } from '../utils/slide-visitor.js';

export interface LinkValidityConfig {
  enabled?: boolean;
  checkExternal?: boolean;
  checkImages?: boolean;
  checkLocalFiles?: boolean;
  allowedProtocols?: string[];
}

const DEFAULT_CONFIG: Required<LinkValidityConfig> = {
  enabled: true,
  checkExternal: false, // External URL checking is slow
  checkImages: true,
  checkLocalFiles: true,
  allowedProtocols: ['http', 'https', 'mailto']
};

interface Link {
  url: string;
  text: string;
  lineNumber: number;
  slideNumber: number;
  isImage: boolean;
}

export function linkValidity(
  content: string,
  filePath: string,
  config: LinkValidityConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const errors: LintError[] = [];

  // Regex patterns for links and images
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const htmlImgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  const htmlLinkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/g;

  visitSlides(content, {
    onLine(line: string, context: LineContext) {
      const links: Link[] = [];

      // Markdown images
      if (mergedConfig.checkImages) {
        let match;
        while ((match = imagePattern.exec(line)) !== null) {
          links.push({
            url: match[2] ?? '',
            text: match[1] ?? '',
            lineNumber: context.lineNumber,
            slideNumber: context.slideNumber,
            isImage: true
          });
        }
        imagePattern.lastIndex = 0; // Reset regex state
      }

      // Markdown links
      let match;
      while ((match = linkPattern.exec(line)) !== null) {
        // Skip if it's actually an image (starts with !)
        const startIndex = match.index;
        if (startIndex > 0 && line[startIndex - 1] === '!') continue;

        links.push({
          url: match[2] ?? '',
          text: match[1] ?? '',
          lineNumber: context.lineNumber,
          slideNumber: context.slideNumber,
          isImage: false
        });
      }
      linkPattern.lastIndex = 0; // Reset regex state

      // HTML images
      if (mergedConfig.checkImages) {
        while ((match = htmlImgPattern.exec(line)) !== null) {
          links.push({
            url: match[1] ?? '',
            text: '',
            lineNumber: context.lineNumber,
            slideNumber: context.slideNumber,
            isImage: true
          });
        }
        htmlImgPattern.lastIndex = 0; // Reset regex state
      }

      // HTML links
      while ((match = htmlLinkPattern.exec(line)) !== null) {
        links.push({
          url: match[1] ?? '',
          text: '',
          lineNumber: context.lineNumber,
          slideNumber: context.slideNumber,
          isImage: false
        });
      }
      htmlLinkPattern.lastIndex = 0; // Reset regex state

      // Validate each link
      for (const link of links) {
        validateLink(link, filePath, errors, mergedConfig);
      }
    }
  });

  return errors;
}

function validateLink(
  link: Link,
  filePath: string,
  errors: LintError[],
  config: Required<LinkValidityConfig>
): void {
  const url = link.url.trim();

  // Skip empty URLs
  if (!url) {
    errors.push({
      ruleId: 'marp/link-validity',
      slideNumber: link.slideNumber,
      lineNumber: link.lineNumber,
      message: `Slide ${link.slideNumber}: Empty ${link.isImage ? 'image source' : 'link URL'}`,
      severity: 'error'
    });
    return;
  }

  // Check protocol
  const protocolMatch = url.match(/^(\w+):/);
  if (protocolMatch) {
    const protocol = protocolMatch[1]?.toLowerCase() ?? '';
    if (!config.allowedProtocols.includes(protocol)) {
      errors.push({
        ruleId: 'marp/link-validity',
        slideNumber: link.slideNumber,
        lineNumber: link.lineNumber,
        message: `Slide ${link.slideNumber}: Unknown protocol "${protocol}" in URL`,
        severity: 'warning'
      });
    }
    // Skip external URL checking for now (would require async)
    return;
  }

  // Check local files
  if (config.checkLocalFiles && !url.startsWith('#')) {
    // Remove query string and fragment
    const cleanUrl = url.split(/[?#]/)[0] ?? '';
    const baseDir = dirname(filePath);
    const absolutePath = resolve(baseDir, cleanUrl);

    if (!existsSync(absolutePath)) {
      errors.push({
        ruleId: 'marp/link-validity',
        slideNumber: link.slideNumber,
        lineNumber: link.lineNumber,
        message: `Slide ${link.slideNumber}: ${link.isImage ? 'Image' : 'File'} not found: ${cleanUrl}`,
        severity: 'error'
      });
    }
  }
}
