import { describe, it, expect } from 'vitest';

const REASON_LOCALIZATIONS: [RegExp, string][] = [
  [/same (commercial|transactional|informational|navigational) intent/i, 'Большинство фраз имеют одинаковый $1 интент'],
  [/mixed (commercial|transactional|informational|navigational) intent/i, 'Смешанный $1 интент'],
  [/high diversity/i, 'Высокое разнообразие тематик'],
  [/low diversity/i, 'Низкое разнообразие тематик'],
  [/good cluster/i, 'Хороший кластер'],
  [/poor cluster/i, 'Слабый кластер'],
  [/high relevance/i, 'Высокая релевантность'],
  [/low relevance/i, 'Низкая релевантность'],
  [/commercial/i, 'Коммерческий'],
  [/informational/i, 'Информационный'],
  [/transactional/i, 'Транзакционный'],
  [/navigational/i, 'Навигационный'],
  [/keywords are too diverse/i, 'Фразы слишком разнообразны'],
  [/keywords share similar/i, 'Фразы имеют схожую'],
];

function localizeReason(reason: string): string {
  for (const [regex, ru] of REASON_LOCALIZATIONS) {
    if (regex.test(reason)) {
      return reason.replace(regex, ru);
    }
  }
  return reason;
}

describe('Cluster quality reason localization', () => {
  it('localize same commercial intent', () => {
    const result = localizeReason('Most keywords share same commercial intent');
    expect(result).toBe('Most keywords share Большинство фраз имеют одинаковый commercial интент');
  });

  it('localize same informational intent', () => {
    const result = localizeReason('Most keywords share same informational intent');
    expect(result).toBe('Most keywords share Большинство фраз имеют одинаковый informational интент');
  });

  it('localize high diversity', () => {
    const result = localizeReason('Keywords have high diversity');
    expect(result).toBe('Keywords have Высокое разнообразие тематик');
  });

  it('localize low diversity', () => {
    const result = localizeReason('Low diversity in cluster');
    expect(result).toBe('Низкое разнообразие тематик in cluster');
  });

  it('localize good cluster', () => {
    const result = localizeReason('This is a good cluster');
    expect(result).toBe('This is a Хороший кластер');
  });

  it('localize poor cluster', () => {
    const result = localizeReason('This is a poor cluster');
    expect(result).toBe('This is a Слабый кластер');
  });

  it('localize high relevance', () => {
    const result = localizeReason('High relevance keywords');
    expect(result).toBe('Высокая релевантность keywords');
  });

  it('localize low relevance', () => {
    const result = localizeReason('Low relevance keywords');
    expect(result).toBe('Низкая релевантность keywords');
  });

  it('localize commercial mention', () => {
    const result = localizeReason('Most keywords are commercial');
    expect(result).toBe('Most keywords are Коммерческий');
  });

  it('localize informational mention', () => {
    const result = localizeReason('Informational intent');
    expect(result).toBe('Информационный intent');
  });

  it('localize transactional mention', () => {
    const result = localizeReason('Transactional intent');
    expect(result).toBe('Транзакционный intent');
  });

  it('localize navigational mention', () => {
    const result = localizeReason('Navigational intent');
    expect(result).toBe('Навигационный intent');
  });

  it('localize keywords are too diverse', () => {
    const result = localizeReason('These keywords are too diverse');
    expect(result).toBe('These Фразы слишком разнообразны');
  });

  it('localize keywords share similar', () => {
    const result = localizeReason('Keywords share similar intent');
    expect(result).toBe('Фразы имеют схожую intent');
  });

  it('return original if no match', () => {
    expect(localizeReason('Some unknown reason text')).toBe('Some unknown reason text');
  });

  it('handle empty string', () => {
    expect(localizeReason('')).toBe('');
  });

  it('score-based tooltip formatting', () => {
    const score = 4;
    const reason = 'Most keywords share same commercial intent';
    const tooltip = 'Оценка качества кластера: ' + score + '/5\n\n' + localizeReason(reason);
    expect(tooltip).toContain('Оценка качества кластера: 4/5');
    expect(tooltip).toContain('Большинство фраз имеют одинаковый commercial интент');
  });
});