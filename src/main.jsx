import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Career Studio route failed to render.', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error" role="alert">
          <h1>This page could not be displayed</h1>
          <p>Your saved browser data has not been deleted. Reload the app to try again.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>Reload app</button>
          <details>
            <summary>Technical details</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);