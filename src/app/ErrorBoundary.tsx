import React from 'react'

type ErrorBoundaryState = {
  error?: Error
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      error
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-background px-5 text-text">
          <div className="w-full max-w-sm rounded-xl bg-surface p-5">
            <h1 className="text-2xl font-black">Ошибка запуска</h1>
            <p className="mt-3 break-words text-sm text-muted">{this.state.error.message}</p>
            <button
              className="mt-5 h-12 w-full rounded-xl bg-accent font-semibold text-white"
              onClick={() => {
                window.localStorage.clear()
                window.location.href = import.meta.env.BASE_URL
              }}
            >
              Сбросить
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
