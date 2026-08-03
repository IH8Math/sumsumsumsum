import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error in UI Boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-lg w-full bg-slate-800 border-2 border-rose-500/50 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertOctagon className="w-10 h-10 animate-pulse" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-rose-300">화면 표시 중 오류 발생</h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                데이터 처리 중 일시적인 오류가 발생했습니다.<br/>
                백색 화면 대신 시스템 복구 모드가 동작 중입니다.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 p-4 rounded-xl border border-rose-900/50 text-left overflow-x-auto text-xs font-mono text-rose-200">
                <p className="font-bold text-rose-400 mb-1">Error Message:</p>
                <code>{this.state.error.toString()}</code>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-5 h-5" />
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
