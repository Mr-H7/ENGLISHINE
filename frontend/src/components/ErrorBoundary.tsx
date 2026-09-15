import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorState } from '@/components/ui';

interface State {
  failed: boolean;
}
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React shell error', error, info);
  }
  render() {
    return this.state.failed ? (
      <main className="ui-container ui-main">
        <ErrorState description="حدث خطأ غير متوقع في واجهة التطبيق." />
      </main>
    ) : (
      this.props.children
    );
  }
}
