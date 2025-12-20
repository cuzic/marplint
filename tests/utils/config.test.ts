import { describe, expect, it } from 'vitest';
import { isRuleEnabled, loadConfig } from '../../src/utils/config.js';

describe('config', () => {
  describe('loadConfig', () => {
    it('should return default config when no config file exists', () => {
      // Use a path where no config file exists
      const config = loadConfig('/tmp/nonexistent');
      expect(config).toBeDefined();
      expect(config.rules).toBeDefined();
      expect(config.viewport).toBeDefined();
    });

    it('should have default values for rules', () => {
      const config = loadConfig('/tmp/nonexistent');
      expect(config.rules['marp/slide-line-count']).toBeDefined();
      expect(config.rules['marp/overflow']).toBeDefined();
    });

    it('should have default viewport dimensions', () => {
      const config = loadConfig('/tmp/nonexistent');
      expect(config.viewport?.width).toBe(1280);
      expect(config.viewport?.height).toBe(720);
    });
  });

  describe('isRuleEnabled', () => {
    it('should return true for enabled rules', () => {
      const config = loadConfig('/tmp/nonexistent');
      expect(isRuleEnabled(config, 'marp/slide-line-count')).toBe(true);
    });

    it('should return false for explicitly disabled rules', () => {
      const config = {
        rules: {
          'marp/slide-line-count': { enabled: false }
        },
        viewport: { width: 1280, height: 720 }
      };
      expect(isRuleEnabled(config, 'marp/slide-line-count')).toBe(false);
    });

    it('should handle boolean rule config', () => {
      const config = {
        rules: {
          'marp/html-blank-lines': false
        },
        viewport: { width: 1280, height: 720 }
      };
      expect(isRuleEnabled(config, 'marp/html-blank-lines')).toBe(false);
    });
  });
});
