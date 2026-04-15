import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-gray-900 text-white">
          <h1 className="text-3xl font-bold mb-4">Something went wrong.</h1>
          <p className="text-gray-400 mb-8">
            The application encountered an unexpected error.
          </p>
          <button
            onClick={() => window.location.href = '/medilens'}
            className="px-6 py-2 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
