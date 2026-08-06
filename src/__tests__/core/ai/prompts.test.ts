import { describe, it, expect } from 'vitest';
import { promptManager } from '@/plugin-sdk';

describe('prompt Manager', () => {
  describe('rename prompt', () => {
    it('should include keywords', () => {
      const result = promptManager.buildPrompt('rename', { keywords: '- купить\n- заказать' });
      expect(result).toContain('купить');
      expect(result).toContain('заказать');
    });

    it('should restrict name length', () => {
      const result = promptManager.buildPrompt('rename', { keywords: '- test' });
      expect(result).toContain('2-4 слова');
    });

    it('should forbid explanations', () => {
      const result = promptManager.buildPrompt('rename', { keywords: '- test' });
      expect(result).toContain('НИКАКИХ объяснений');
    });
  });

  describe('group-notes prompt', () => {
    it('should include keywords', () => {
      const result = promptManager.buildPrompt('group-notes', { keywords: '- seo\n- продвижение' });
      expect(result).toContain('seo');
      expect(result).toContain('продвижение');
    });

    it('should limit description length', () => {
      const result = promptManager.buildPrompt('group-notes', { keywords: '- test' });
      expect(result).toContain('15 слов');
    });
  });

  describe('getTemplate and defaults', () => {
    it('should return default template when no override', () => {
      const template = promptManager.getTemplate('rename');
      expect(template).toContain('PPC-специалист');
    });

    it('should return stored override', () => {
      promptManager.setTemplate('rename', 'Custom rename prompt {{keywords}}');
      expect(promptManager.getTemplate('rename')).toBe('Custom rename prompt {{keywords}}');
      promptManager.resetToDefault('rename');
    });

    it('should list variables', () => {
      const vars = promptManager.getVariables('rename');
      expect(vars).toContain('keywords');
    });
  });
});
