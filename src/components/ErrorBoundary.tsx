import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isStaleChunkError, reloadForNewVersion } from '../utils/staleVersion';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Shows a "Recargar" screen instead of a blank page if something throws while
 * rendering. Reloading is always safe: every action is written to Supabase, or
 * the offline queue, the moment it's recorded — nothing lives only in memory.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Render error caught by ErrorBoundary', error, info.componentStack);
    if (isStaleChunkError(error)) reloadForNewVersion();
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-bold text-white">Algo ha fallado</p>
        <p className="max-w-sm text-sm text-slate-400">
          Lo que hayas anotado está guardado: al recargar seguirá ahí y podrás continuar.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-amber-500 px-6 py-3.5 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-transform touch-manipulation active:scale-95"
        >
          Recargar
        </button>
      </div>
    );
  }
}
