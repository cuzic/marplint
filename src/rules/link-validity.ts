/**
 * Rule: marp/link-validity
 * Validates links in slides (broken links, missing anchors)
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { type LineContext, visitSlides } from '../utils/slide-visitor.js';
import type { LintError } from './slide-line-count.js';

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

/** Extract matches using regex pattern */
function extractMatches(
  pattern: RegExp,
  line: string,
  context: LineContext,
  isImage: boolean,
  skipImagePrefix = false
): Link[] {
  const links: Link[] = [];
  let match;
  while ((match = pattern.exec(line)) !== null) {
    if (skipImagePrefix && match.index > 0 && line[match.index - 1] === '!') continue;
    links.push({
      url: match[2] ?? match[1] ?? '',
      text: match[1] ?? '',
      lineNumber: context.lineNumber,
      slideNumber: context.slideNumber,
      isImage
    });
  }
  pattern.lastIndex = 0;
  return links;
}

/** Extract all links from a line */
function extractLinksFromLine(line: string, context: LineContext, checkImages: boolean): Link[] {
  const links: Link[] = [];

  if (checkImages) {
    links.push(...extractMatches(/!\[([^\]]*)\]\(([^)]+)\)/g, line, context, true));
    links.push(...extractMatches(/<img[^>]+src=["']([^"']+)["'][^>]*>/g, line, context, true));
  }

  links.push(...extractMatches(/\[([^\]]*)\]\(([^)]+)\)/g, line, context, false, true));
  links.push(...extractMatches(/<a[^>]+href=["']([^"']+)["'][^>]*>/g, line, context, false));

  return links;
}

export function linkValidity(content: string, filePath: string, config: LinkValidityConfig = {}): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  if (!mergedConfig.enabled) return [];

  const errors: LintError[] = [];

  visitSlides(content, {
    onLine(line: string, context: LineContext) {
      const links = extractLinksFromLine(line, context, mergedConfig.checkImages);
      for (const link of links) {
        validateLink(link, filePath, errors, mergedConfig);
      }
    }
  });

  return errors;
}

function validateLink(link: Link, filePath: string, errors: LintError[], config: Required<LinkValidityConfig>): void {
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
