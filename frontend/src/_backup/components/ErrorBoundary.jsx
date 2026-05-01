import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Layout Crash Detected:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center bg-red-50 min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-black text-red-600 uppercase">Sistem Mengalami Gangguan Render</h1>
          <p className="text-slate-500 mt-2">Cek konsol browser untuk detail (ReferenceError).</p>
          <button onClick={() => window.location.reload()} className="mt-6 bg-red-600 text-white px-6 py-2 rounded-xl">Reload System</button>
        </div>
      );
    }
    return this.props.children; 
  }
}
export default ErrorBoundary;