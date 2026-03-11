import type { CSSProperties } from 'react';

export const PRIMARY_BUTTON_SIZE_STYLES: Record<'large' | 'small', CSSProperties> = {
  large: { padding: '0.75rem 2rem', fontSize: '1.125rem', borderRadius: '0.5rem' },
  small: { padding: '0.375rem 1rem', borderRadius: '0.375rem' },
};
