import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Crash detected:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 uppercase">Terjadi Kesalahan</h1>
              <p className="text-sm text-slate-400 mt-2">
                Sistem mengalami gangguan render. Silakan muat ulang halaman.
              </p>
              {this.state.error && (
                <p className="text-xs text-red-400 mt-2 font-mono bg-red-50 p-2 rounded-lg">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#006432] text-white rounded-xl text-sm font-bold hover:bg-[#005028] transition-colors"
            >
              <RefreshCw size={16} />
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;