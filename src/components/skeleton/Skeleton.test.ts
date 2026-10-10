import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('is a hidden pulsing block that stops pulsing for reduced motion', () => {
    const html = renderToStaticMarkup(createElement(Skeleton, { className: 'h-4 w-32 rounded-md' }));
    expect(html).toBe('<div aria-hidden="true" class="animate-pulse bg-line motion-reduce:animate-none h-4 w-32 rounded-md"></div>');
  });
});
