// ============================================================
// Tests: ApplyPreview — единый шаблон предпросмотра перед применением
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplyPreview } from '@/components/ApplyPreview';
import type { ApplyPreviewItem } from '@/components/ApplyPreview';

const items: ApplyPreviewItem[] = [
  { id: '1', text: 'купить ноутбук', type: 'remove', note: 'останется «купить ноутбук»' },
  { id: '2', text: 'старый текст', type: 'replace', replacement: 'новый текст' },
];

describe('ApplyPreview', () => {
  it('показывает заголовок, сводку и счётчики', () => {
    render(
      <ApplyPreview
        title="Предпросмотр дедупликации"
        summary="Будет удалено 2 фразы"
        counters={[{ label: 'Будет удалено', value: 2 }]}
        items={items}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText('Предпросмотр дедупликации')).toBeInTheDocument();
    expect(screen.getByText('Будет удалено 2 фразы')).toBeInTheDocument();
    expect(screen.getByText(/Будет удалено:/)).toBeInTheDocument();
  });

  it('выводит список примеров изменений', () => {
    render(<ApplyPreview title="Предпросмотр" items={items} onApply={() => {}} onCancel={() => {}} />);

    const rows = screen.getAllByTestId('apply-preview-item');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('купить ноутбук')).toBeInTheDocument();
    expect(screen.getByText('останется «купить ноутбук»')).toBeInTheDocument();
  });

  it('подсвечивает удаляемый текст (зачёркнутый) и замену', () => {
    render(<ApplyPreview title="Предпросмотр" items={items} onApply={() => {}} onCancel={() => {}} />);

    const removed = screen.getByText('купить ноутбук');
    expect(removed.className).toContain('line-through');
    expect(removed.className).toContain('kc-red');

    const replacement = screen.getByText('новый текст');
    expect(replacement.className).toContain('kc-green');
    expect(screen.getByText('старый текст').className).toContain('line-through');
  });

  it('вызывает onApply по кнопке «Применить»', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<ApplyPreview title="Предпросмотр" items={items} onApply={onApply} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('вызывает onCancel по кнопке «Отмена»', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<ApplyPreview title="Предпросмотр" items={items} onApply={onApply} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('вызывает onCancel по кнопке закрытия предпросмотра', () => {
    const onCancel = vi.fn();
    render(<ApplyPreview title="Предпросмотр" items={items} onApply={() => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть предпросмотр' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('блокирует кнопки в состоянии busy', () => {
    const onApply = vi.fn();
    render(<ApplyPreview title="Предпросмотр" items={items} busy onApply={onApply} onCancel={() => {}} />);

    const applyBtn = screen.getByRole('button', { name: 'Применение...' });
    expect(applyBtn).toBeDisabled();
    fireEvent.click(applyBtn);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('показывает сообщение об отсутствии изменений и блокирует «Применить»', () => {
    const onApply = vi.fn();
    render(
      <ApplyPreview
        title="Предпросмотр"
        items={[]}
        emptyMessage="Дубликаты не найдены"
        onApply={onApply}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText('Дубликаты не найдены')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Применить' })).toBeDisabled();
    expect(screen.queryAllByTestId('apply-preview-item')).toHaveLength(0);
  });

  it('показывает «Показано N из M», если список примеров усечён', () => {
    render(
      <ApplyPreview
        title="Предпросмотр"
        items={items}
        totalCount={10}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText('Показано 2 из 10')).toBeInTheDocument();
  });

  it('позволяет переопределить подписи кнопок', () => {
    render(
      <ApplyPreview
        title="Предпросмотр"
        items={items}
        applyLabel="Удалить 2 фразы"
        cancelLabel="Закрыть"
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Удалить 2 фразы' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
  });
});
