import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LimitsSection } from '@/dashboard/views/LimitsSection';

describe('limits section', () => {
  it('limits_section_shows_spent_limit_and_status', () => {
    render(
      <LimitsSection
        limits={{ 'youtube.com': 1800 }}
        spent={new Map([['youtube.com', 900]])}
        visitedDomains={['youtube.com', 'github.com']}
        prefillDomain={null}
        onSave={async () => true}
        onRemove={async () => true}
      />,
    );

    expect(screen.getByText('youtube.com')).toBeTruthy();
    expect(screen.getByText('15m / 30m')).toBeTruthy();
    expect(screen.getByText('Within limit')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('limits_section_marks_a_domain_over_its_limit', () => {
    render(
      <LimitsSection
        limits={{ 'youtube.com': 1800 }}
        spent={new Map([['youtube.com', 3600]])}
        visitedDomains={['youtube.com', 'github.com']}
        prefillDomain={null}
        onSave={async () => true}
        onRemove={async () => true}
      />,
    );

    expect(screen.getByText('Over limit')).toBeTruthy();
  });

  it('limits_section_offers_visited_domains_in_the_form', () => {
    const { container } = render(
      <LimitsSection
        limits={{ 'youtube.com': 1800 }}
        spent={new Map([['youtube.com', 900]])}
        visitedDomains={['youtube.com', 'github.com']}
        prefillDomain={null}
        onSave={async () => true}
        onRemove={async () => true}
      />,
    );

    const field = screen.getByLabelText('Domain');
    expect(field.getAttribute('list')).toBe('visited-domains');

    const list = container.querySelector('#visited-domains');
    expect(list).not.toBeNull();
    const values = Array.from(list!.querySelectorAll('option')).map((option) => option.value);
    expect(values).toContain('github.com');
  });

  it('limits_section_clears_the_form_on_escape', () => {
    render(
      <LimitsSection
        limits={{ 'youtube.com': 1800 }}
        spent={new Map([['youtube.com', 900]])}
        visitedDomains={['youtube.com', 'github.com']}
        prefillDomain={null}
        onSave={async () => true}
        onRemove={async () => true}
      />,
    );

    const domainField = screen.getByLabelText('Domain') as HTMLInputElement;
    const minutesField = screen.getByLabelText('Minutes per day') as HTMLInputElement;

    fireEvent.change(domainField, { target: { value: 'example.com' } });
    fireEvent.change(minutesField, { target: { value: '30' } });
    expect(domainField.value).toBe('example.com');
    expect(minutesField.value).toBe('30');

    fireEvent.keyDown(domainField, { key: 'Escape' });

    expect(domainField.value).toBe('');
    expect(minutesField.value).toBe('');
  });

  it('limits_section_shows_the_empty_state', () => {
    render(
      <LimitsSection
        limits={{}}
        spent={new Map()}
        visitedDomains={['youtube.com', 'github.com']}
        prefillDomain={null}
        onSave={async () => true}
        onRemove={async () => true}
      />,
    );

    expect(screen.getByText('No limits set')).toBeTruthy();
  });
});
