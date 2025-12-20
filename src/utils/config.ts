/**
 * Configuration management for marplint
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
 * Find and load configuration file
 */
export function loadConfig(startDir?: string): MarplintConfig {
  const searchDir = startDir ?? process.cwd();

  // Search for config file
  let currentDir = searchDir;
  while (currentDir !== dirname(currentDir)) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename);
      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, 'utf-8');
          const userConfig = JSON.parse(content) as Partial<MarplintConfig>;
          return mergeConfig(DEFAULT_CONFIG, userConfig);
        } catch {
          console.warn(`Failed to parse config file: ${configPath}`);
        }
      }
    }
    currentDir = dirname(currentDir);
  }

  return DEFAULT_CONFIG;
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
