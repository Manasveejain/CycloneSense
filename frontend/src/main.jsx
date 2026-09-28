import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

console.log('✓ main.jsx loaded - Starting React app');

const rootElement = document.getElementById('root');
console.log('✓ Root element found:', rootElement);

if (!rootElement) {
  console.error('✗ CRITICAL: Root element not found!');
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
  console.log('✓ React app mounted successfully');
}
