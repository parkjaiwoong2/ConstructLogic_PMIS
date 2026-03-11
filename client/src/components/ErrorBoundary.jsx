import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', maxWidth: 600 }}>
          <h2>오류가 발생했습니다</h2>
          <p style={{ color: '#c00', marginBottom: '1rem' }}>{String(this.state.error?.message || this.state.error)}</p>
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
