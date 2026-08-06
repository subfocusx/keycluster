import { describe, it, expect } from 'vitest';
import { UnionFind } from '@user-plugins/implicit-duplicates/union-find';

describe('UnionFind', () => {
  describe('find', () => {
    it('should return element itself when not in any group', () => {
      const uf = new UnionFind();
      expect(uf.find('a')).toBe('a');
    });

    it('should return root after union', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      expect(uf.find('a')).toBe(uf.find('b'));
    });

    it('should handle path compression', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      uf.union('b', 'c');
      expect(uf.find('a')).toBe(uf.find('c'));
    });
  });

  describe('union', () => {
    it('should merge two sets', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      expect(uf.find('a')).toBe(uf.find('b'));
    });

    it('should be idempotent', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      uf.union('a', 'b');
      expect(uf.find('a')).toBe(uf.find('b'));
    });

    it('should merge multiple sets', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      uf.union('b', 'c');
      uf.union('c', 'd');
      expect(uf.find('a')).toBe(uf.find('d'));
    });

    it('should use rank for optimization', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      uf.union('c', 'd');
      uf.union('a', 'c');
      expect(uf.find('b')).toBe(uf.find('d'));
    });
  });

  describe('getGroups', () => {
    it('should return empty map for empty structure', () => {
      const uf = new UnionFind();
      expect(uf.getGroups().size).toBe(0);
    });

    it('should return single element groups', () => {
      const uf = new UnionFind();
      uf.find('a');
      uf.find('b');
      const groups = uf.getGroups();
      expect(groups.size).toBe(2);
    });

    it('should group connected elements', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      uf.union('b', 'c');
      uf.find('d');
      const groups = uf.getGroups();
      expect(groups.size).toBe(2);
      const groupA = groups.get(uf.find('a'));
      expect(groupA).toContain('a');
      expect(groupA).toContain('b');
      expect(groupA).toContain('c');
    });

    it('should handle multiple separate groups', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      uf.union('c', 'd');
      uf.union('e', 'f');
      const groups = uf.getGroups();
      expect(groups.size).toBe(3);
    });
  });
});
