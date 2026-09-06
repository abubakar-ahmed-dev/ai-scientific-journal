import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error in component tree:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/dashboard";
  };

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-app-border shadow-lg max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h1 className="text-lg font-bold text-slate-900">Application Error Encountered</h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                An unexpected UI exception occurred. Your scientific data in Firestore remains secure.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-50 p-3 rounded-lg border border-app-border text-left text-[11px] font-mono text-slate-700 max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs"
              >
                <Home className="w-3.5 h-3.5" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
