import React, { Component, ReactNode } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * Error boundary specifically for authentication-related errors.
 * Prevents auth errors from crashing the entire application.
 */
export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log authentication errors but don't crash the app
    console.error('Authentication Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI for auth errors
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback: show loading spinner instead of error
      // This prevents auth race conditions from showing error states
      return <LoadingSpinner />;
    }

    return this.props.children;
  }
}