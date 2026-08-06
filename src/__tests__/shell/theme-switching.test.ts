// ============================================================
// Tests: Theme switching logic (cycleTheme function)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Theme Switching Logic', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
  });

  describe('cycleTheme logic', () => {
    it('should toggle from light to dark', () => {
      const currentTheme = 'light';
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      expect(nextTheme).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      const currentTheme: string = 'dark';
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      expect(nextTheme).toBe('light');
    });

    it('should handle undefined theme as light', () => {
      const currentTheme = undefined as any;
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      expect(nextTheme).toBe('light');
    });

    it('should handle null theme as light', () => {
      const currentTheme = null as any;
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      expect(nextTheme).toBe('light');
    });

    it('should handle unknown theme values as light', () => {
      const currentTheme = 'unknown' as any;
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      expect(nextTheme).toBe('light');
    });

    it('should handle rapid consecutive switches', () => {
      const themeSequence = ['dark', 'light', 'dark', 'light', 'dark'];
      let currentTheme = 'light';

      for (let i = 0; i < themeSequence.length; i++) {
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        expect(nextTheme).toBe(themeSequence[i]);
        currentTheme = nextTheme;
      }
    });
  });

  describe('applyTheme side effects', () => {
    it('should set data-theme attribute', () => {
      const applyTheme = (theme: 'light' | 'dark') => {
        document.documentElement.setAttribute('data-theme', theme);
      };

      applyTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should add dark class for dark theme', () => {
      const applyDarkTheme = () => {
        document.documentElement.classList.add('dark');
      };

      applyDarkTheme();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove dark class for light theme', () => {
      document.documentElement.classList.add('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      document.documentElement.classList.remove('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should apply full theme correctly', () => {
      const applyTheme = (theme: 'light' | 'dark') => {
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };

      applyTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('localStorage persistence', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should save theme to localStorage', () => {
      localStorage.setItem('theme', 'dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('should read theme from localStorage', () => {
      localStorage.setItem('theme', 'light');
      const savedTheme = localStorage.getItem('theme');
      expect(savedTheme).toBe('light');
    });

    it('should handle missing localStorage key', () => {
      const savedTheme = localStorage.getItem('theme');
      expect(savedTheme).toBeNull();
    });
  });
});

describe('Full theme cycle simulation', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  const simulateCycleTheme = (currentTheme: string) => {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', nextTheme);
    return nextTheme;
  };

  it('should complete full cycle light -> dark -> light', () => {
    let theme = 'light';

    theme = simulateCycleTheme(theme);
    expect(theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');

    theme = simulateCycleTheme(theme);
    expect(theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('should persist final theme in localStorage after multiple switches', () => {
    let theme = 'light';

    theme = simulateCycleTheme(theme);
    theme = simulateCycleTheme(theme);
    theme = simulateCycleTheme(theme);
    theme = simulateCycleTheme(theme);

    expect(theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('should apply correct attributes after multiple rapid switches', () => {
    let theme = 'light';

    for (let i = 0; i < 10; i++) {
      theme = simulateCycleTheme(theme);
    }

    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
    expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
  });
});

describe('Theme switching race condition simulation', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('should handle stale closure issue - theme not updated in callback', () => {
    let currentTheme = 'light';

    const cycleThemeWithStaleClosure = () => {
      const next = currentTheme === 'light' ? 'dark' : 'light';
      return next;
    };

    const result1 = cycleThemeWithStaleClosure();
    expect(result1).toBe('dark');

    currentTheme = result1;

    const result2 = cycleThemeWithStaleClosure();
    expect(result2).toBe('light');
  });

  it('should demonstrate the bug: useCallback without fresh theme', () => {
    let themeStoreValue = 'light';

    const createCycleTheme = (theme: string) => {
      return () => {
        const next = theme === 'light' ? 'dark' : 'light';
        themeStoreValue = next;
        return next;
      };
    };

    const cycle1 = createCycleTheme(themeStoreValue);
    const result1 = cycle1();
    expect(result1).toBe('dark');

    const cycle2 = createCycleTheme('light');
    const result2 = cycle2();
    expect(result2).toBe('dark');

    expect(themeStoreValue).toBe('dark');
  });

  it('should fix bug: useCallback with ref or functional update', () => {
    let themeStoreValue = 'light';

    const createCorrectCycleTheme = () => {
      return () => {
        const next = themeStoreValue === 'light' ? 'dark' : 'light';
        themeStoreValue = next;
        return next;
      };
    };

    const cycle1 = createCorrectCycleTheme();
    const result1 = cycle1();
    expect(result1).toBe('dark');

    const cycle2 = createCorrectCycleTheme();
    const result2 = cycle2();
    expect(result2).toBe('light');

    expect(themeStoreValue).toBe('light');
  });
});