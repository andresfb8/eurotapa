import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches any render/lifecycle error so a live gala never ends in a white screen.
 * Shows what broke and offers a way back to the saved state.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en la interfaz:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetSession = () => {
    try {
      window.localStorage.removeItem('eurotapa_session_v2');
    } catch {
      // ignore
    }
    window.history.replaceState({}, '', window.location.pathname);
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-canvas)',
          padding: '24px'
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: '600px',
            width: '100%',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          <div>
            <span className="badge badge-red">Pantalla recuperable</span>
            <h1 style={{ fontSize: '1.7rem', marginTop: '8px' }}>Algo se ha roto en la interfaz</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px', lineHeight: 1.5 }}>
              El concurso, los votos y los participantes siguen guardados. Recarga para continuar: la gala
              se reanudará en el estado más reciente.
            </p>
          </div>

          <pre
            className="mono"
            style={{
              margin: 0,
              padding: '12px 14px',
              backgroundColor: 'var(--color-canvas)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--pastel-red-text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '180px',
              overflowY: 'auto'
            }}
          >
            {error.message || String(error)}
          </pre>

          <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              Recargar aplicación
            </button>
            <button type="button" className="btn btn-secondary" onClick={this.handleResetSession}>
              Cerrar sesión y volver al acceso
            </button>
          </div>
        </div>
      </div>
    );
  }
}
