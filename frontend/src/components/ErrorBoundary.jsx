import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700 max-w-md text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
            <p className="text-slate-300 mb-6">Attempting to restore your game...</p>
            <button 
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
            >
              Reload Game
            </button>
            <details className="mt-6 text-left text-xs text-slate-500 overflow-auto max-h-32">
               <summary className="cursor-pointer">Error Details</summary>
               <pre className="mt-2 p-2 bg-slate-950 rounded">{this.state.error && this.state.error.toString()}</pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
