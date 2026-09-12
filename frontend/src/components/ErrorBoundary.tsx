import { Component, type ErrorInfo, type ReactNode } from "react";

import { log } from "../services/logger";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("渲染异常", error, info);
    void log("error", "ui.error_boundary", error.message, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md rounded-md border border-line bg-panel px-6 py-5 text-center">
            <div className="font-mono text-sm font-semibold text-[#8f2f2f]">
              画布渲染异常
            </div>
            <div className="mt-2 break-all font-mono text-xs text-muted">
              {this.state.error.message}
            </div>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded border border-line bg-paper px-3 py-1.5 font-mono text-xs transition-colors hover:border-blueprint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
