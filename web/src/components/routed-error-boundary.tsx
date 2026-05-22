'use client';

import { usePathname } from 'next/navigation';
import { ErrorBoundary } from '@/components/error-boundary';

export function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}
