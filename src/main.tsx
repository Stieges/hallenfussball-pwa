import React from 'react';
import ReactDOM from 'react-dom/client';

// Font: Inter Variable (self-hosted via @fontsource for offline capability)
import '@fontsource-variable/inter';

import App from './App';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
