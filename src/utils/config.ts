/**
 * Configuration management for marplint
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

// Known rule names for validation
const KNOWN_RULES = [
  'marp/slide-line-count',
  'marp/slide-content-density',
  'marp/html-blank-lines',
  'marp/missing-font-class',
  'marp/balanced-columns',
  'marp/heading-hierarchy',
  'marp/code-block-length',
  'marp/link-validity',
  'marp/japanese-consistency',
  'marp/slide-title-required',
  'marp/table-structure',
  'marp/duplicate-content',
  'marp/max-nested-list',
  'marp/overflow',
  'marp/whitespace',
  'marp/font-readability',
  'marp/color-contrast',
  'marp/element-overlap',
  'marp/text-truncation'
] as const;

// Zod schemas for validation
const ruleConfigSchema = z
  .union([
    z.boolean(),
    z
      .object({
        enabled: z.boolean().optional()
      })
      .passthrough()
  ])
  .optional();

const configSchema = z.object({
  rules: z.record(z.string(), ruleConfigSchema).optional().default({}),
  viewport: z
    .object({
      width: z.number().positive().optional(),
      height: z.number().positive().optional()
    })
    .optional()
});

export type MarplintConfigInput = z.input<typeof configSchema>;
export type MarplintConfigParsed = z.output<typeof configSchema>;

export interface RuleConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface MarplintConfig {
  rules: {
    'marp/slide-line-count'?: RuleConfig & {
      maxLines?: number;
      minLines?: number;
      ignoreCodeBlocks?: boolean;
    };
    'marp/slide-content-density'?: RuleConfig & {
      maxCharacters?: number;
      maxListItems?: number;
    };
    'marp/html-blank-lines'?: boolean | RuleConfig;
    'marp/missing-font-class'?: boolean | RuleConfig;
    'marp/balanced-columns'?: RuleConfig & {
      maxImbalance?: number;
    };
    'marp/overflow'?: RuleConfig & {
      threshold?: number;
    };
    'marp/whitespace'?: RuleConfig & {
      minUtilization?: number;
    };
  };
  viewport?: {
    width?: number;
    height?: number;
  };
}

const DEFAULT_CONFIG: MarplintConfig = {
  rules: {
    'marp/slide-line-count': {
      enabled: true,
      maxLines: 30,
      minLines: 5,
      ignoreCodeBlocks: false
    },
    'marp/slide-content-density': {
      enabled: true,
      maxCharacters: 800,
      maxListItems: 15
    },
    'marp/html-blank-lines': true,
    'marp/missing-font-class': true,
    'marp/balanced-columns': {
      enabled: true,
      maxImbalance: 0.3
    },
    'marp/overflow': {
      enabled: true,
      threshold: 10
    },
    'marp/whitespace': {
      enabled: true,
      minUtilization: 0.4
    }
  },
  viewport: {
    width: 1280,
    height: 720
  }
};

const CONFIG_FILENAMES = ['.marplintrc.json', '.marplintrc', 'marplint.config.json'];

/**
 * Validate and warn about unknown rule names
 */
function validateRuleNames(rules: Record<string, unknown>, configPath: string): void {
  const unknownRules = Object.keys(rules).filter(
    (ruleName) => !KNOWN_RULES.includes(ruleName as (typeof KNOWN_RULES)[number])
  );

  if (unknownRules.length > 0) {
    console.warn(`[marplint] Unknown rule(s) in ${configPath}:`);
    for (const rule of unknownRules) {
      console.warn(`  - "${rule}" (did you mean one of: ${findSimilarRules(rule).join(', ')}?)`);
    }
  }
}

/**
 * Find similar rule names for suggestions
 */
function findSimilarRules(input: string): string[] {
  const inputLower = input.toLowerCase();
  return KNOWN_RULES.filter((rule) => {
    const ruleLower = rule.toLowerCase();
    return ruleLower.includes(inputLower.replace('marp/', '')) || inputLower.includes(ruleLower.replace('marp/', ''));
  }).slice(0, 3);
}

/** Find config file path in directory tree */
function findConfigFile(searchDir: string): string | null {
  let currentDir = searchDir;
  while (currentDir !== dirname(currentDir)) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename);
      if (existsSync(configPath)) return configPath;
    }
    currentDir = dirname(currentDir);
  }
  return null;
}

/** Parse and validate config file */
function parseConfigFile(configPath: string): MarplintConfigParsed | null {
  try {
    const content = readFileSync(configPath, 'utf-8');
    const rawConfig = JSON.parse(content) as unknown;
    const parseResult = configSchema.safeParse(rawConfig);

    if (!parseResult.success) {
      console.warn(`[marplint] Invalid config in ${configPath}:`);
      for (const issue of parseResult.error.issues) {
        console.warn(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
      return null;
    }

    if (parseResult.data.rules) {
      validateRuleNames(parseResult.data.rules, configPath);
    }

    return parseResult.data;
  } catch (error) {
    console.warn(
      `[marplint] Failed to parse config file ${configPath}: ${error instanceof Error ? error.message : error}`
    );
    return null;
  }
}

/**
 * Find and load configuration file
 */
export function loadConfig(startDir?: string): MarplintConfig {
  const searchDir = startDir ?? process.cwd();
  const configPath = findConfigFile(searchDir);

  if (!configPath) return DEFAULT_CONFIG;

  const parsedConfig = parseConfigFile(configPath);
  if (!parsedConfig) return DEFAULT_CONFIG;

  return mergeConfig(DEFAULT_CONFIG, parsedConfig as Partial<MarplintConfig>);
}

/**
 * Merge user config with default config
 */
function mergeConfig(defaultConfig: MarplintConfig, userConfig: Partial<MarplintConfig>): MarplintConfig {
  return {
    rules: {
      ...defaultConfig.rules,
      ...userConfig.rules
    },
    viewport: {
      ...defaultConfig.viewport,
      ...userConfig.viewport
    }
  };
}

/**
 * Check if a rule is enabled
 */
export function isRuleEnabled(config: MarplintConfig, ruleName: keyof MarplintConfig['rules']): boolean {
  const ruleConfig = config.rules[ruleName];
  if (typeof ruleConfig === 'boolean') {
    return ruleConfig;
  }
  if (typeof ruleConfig === 'object') {
    return ruleConfig.enabled !== false;
  }
  return true;
}

/**
 * Get rule-specific configuration
 */
export function getRuleConfig<T extends keyof MarplintConfig['rules']>(
  config: MarplintConfig,
  ruleName: T
): MarplintConfig['rules'][T] {
  return config.rules[ruleName] ?? {};
}
