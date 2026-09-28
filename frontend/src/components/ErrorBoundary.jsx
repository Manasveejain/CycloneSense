import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-8 flex items-center justify-center">
          <div className="max-w-2xl w-full bg-red-950/20 border-2 border-red-500 rounded-xl p-6">
            <h1 className="text-2xl font-bold text-red-400 mb-4">
              Application Error
            </h1>
            <p className="text-slate-300 mb-4">
              Something went wrong. Please check the console for more details.
            </p>
            {this.state.error && (
              <div className="bg-slate-950 p-4 rounded-lg font-mono text-sm overflow-auto">
                <div className="text-red-400 font-bold mb-2">Error:</div>
                <div className="text-slate-300">{this.state.error.toString()}</div>
                {this.state.errorInfo && (
                  <>
                    <div className="text-red-400 font-bold mt-4 mb-2">Stack Trace:</div>
                    <pre className="text-slate-400 text-xs whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-lg"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
