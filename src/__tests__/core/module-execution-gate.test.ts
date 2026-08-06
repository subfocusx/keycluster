import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleExecutionGate, executionGate } from '@/core/module-execution-gate';

describe('Module Execution Gate', () => {
  let gate: ModuleExecutionGate;

  beforeEach(() => {
    gate = new ModuleExecutionGate();
  });

  it('should allow all modules by default', () => {
    expect(gate.isAllowed('ai')).toBe(true);
    expect(gate.isAllowed('minus-words')).toBe(true);
    expect(gate.isAllowed('any-module')).toBe(true);
  });

  it('should block a disabled module', () => {
    gate.disable('ai');
    expect(gate.isAllowed('ai')).toBe(false);
    expect(gate.isBlocked('ai')).toBe(true);
  });

  it('should re-enable a previously disabled module', () => {
    gate.disable('ai');
    expect(gate.isAllowed('ai')).toBe(false);

    gate.enable('ai');
    expect(gate.isAllowed('ai')).toBe(true);
    expect(gate.isBlocked('ai')).toBe(false);
  });

  it('should not affect other modules when disabling one', () => {
    gate.disable('ai');
    expect(gate.isAllowed('minus-words')).toBe(true);
    expect(gate.isAllowed('groups')).toBe(true);
  });

  it('should clear all blocks', () => {
    gate.disable('ai');
    gate.disable('minus-words');
    gate.clear();
    expect(gate.isAllowed('ai')).toBe(true);
    expect(gate.isAllowed('minus-words')).toBe(true);
  });

  it('should return false for isBlocked on enabled module', () => {
    expect(gate.isBlocked('ai')).toBe(false);
  });

  it('should be idempotent — double disable is safe', () => {
    gate.disable('ai');
    gate.disable('ai');
    expect(gate.isAllowed('ai')).toBe(false);
  });

  it('should be idempotent — double enable is safe', () => {
    gate.disable('ai');
    gate.enable('ai');
    gate.enable('ai');
    expect(gate.isAllowed('ai')).toBe(true);
  });
});

describe('executionGate (singleton)', () => {
  beforeEach(() => {
    executionGate.clear();
  });

  it('should be a singleton ModuleExecutionGate instance', () => {
    expect(executionGate).toBeInstanceOf(ModuleExecutionGate);
  });

  it('should block modules across imports', () => {
    executionGate.disable('shared-module');
    expect(executionGate.isAllowed('shared-module')).toBe(false);
  });
});
