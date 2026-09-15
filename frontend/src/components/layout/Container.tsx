import type { ComponentProps } from 'react';
import { classes } from '@/utils/classes';

export function Container({ className, ...props }: ComponentProps<'div'>) {
  return <div className={classes('ui-container', className)} {...props} />;
}

export function ContentWrapper({ className, ...props }: ComponentProps<'div'>) {
  return <div className={classes('ui-content', className)} {...props} />;
}
