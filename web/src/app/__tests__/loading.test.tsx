// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import Loading from '../loading';

describe('Loading page', () => {
  afterEach(cleanup);

  it('renders spinner', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('centers content', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.justify-center')).toBeTruthy();
  });
});
