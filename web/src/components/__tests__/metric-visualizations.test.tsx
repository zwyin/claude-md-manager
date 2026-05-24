// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import {
  MiniSparkline,
  MiniCoverageBar,
  MiniDepthBar,
  InlineMetricBar,
  DetailMetricBar,
  DepthGauge,
} from '../metric-visualizations';

describe('MiniSparkline', () => {
  afterEach(cleanup);

  it('renders SVG with aria-label', () => {
    const { container } = render(<MiniSparkline session={10} matches={5} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-label')).toBe('5 matches in 10 sessions');
  });

  it('renders two circles for data points', () => {
    const { container } = render(<MiniSparkline session={10} matches={5} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });
});

describe('MiniCoverageBar', () => {
  afterEach(cleanup);

  it('renders bar proportional to value', () => {
    const { container } = render(<MiniCoverageBar value={0.5} />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
    expect(rects[1].getAttribute('width')).toBe(String(Math.round(0.5 * 28)));
  });

  it('has correct aria-label', () => {
    const { container } = render(<MiniCoverageBar value={0.75} />);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('75% coverage');
  });
});

describe('MiniDepthBar', () => {
  afterEach(cleanup);

  it('renders depth visualization', () => {
    const { container } = render(<MiniDepthBar value={3} max={10} />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
  });

  it('handles zero max gracefully', () => {
    const { container } = render(<MiniDepthBar value={3} max={0} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});

describe('InlineMetricBar', () => {
  afterEach(cleanup);

  it('renders bar with custom color', () => {
    const { container } = render(<InlineMetricBar value={0.6} color="#ff0000" />);
    const rects = container.querySelectorAll('rect');
    expect(rects[1].getAttribute('fill')).toBe('#ff0000');
  });
});

describe('DetailMetricBar', () => {
  afterEach(cleanup);

  it('clamps value to max', () => {
    const { container } = render(<DetailMetricBar value={2} color="#00f" max={1} />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
  });
});

describe('DepthGauge', () => {
  afterEach(cleanup);

  it('renders vertical gauge', () => {
    const { container } = render(<DepthGauge value={5} max={10} />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
  });

  it('renders circle indicator', () => {
    const { container } = render(<DepthGauge value={5} max={10} />);
    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();
  });
});
