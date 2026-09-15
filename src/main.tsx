
const originalFetch = window.fetch;
try {
  window.fetch = async function (...args) {
  const response = await originalFetch(...args);
  if (response.status === 401 || response.status === 403) {
    // If it's an API request, we should probably log the user out
    const url = typeof args[0] === 'string' ? args[0] : ('url' in (args[0] as any) ? (args[0] as any).url : (args[0] as any).href);
    if (url && url.startsWith('/api/') && url !== '/api/users/login') {
      window.dispatchEvent(new Event('auth-error'));
    }
  }
  return response;
  };
} catch (e) {
  console.warn('Could not override window.fetch', e);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

// Patch Response.prototype.json to gracefully handle HTML error pages from proxies/gateways
const originalJson = Response.prototype.json;
Response.prototype.json = async function () {
  const text = await this.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    if (text.trim().startsWith('<')) {
      console.warn('Received HTML instead of JSON from server. Check server status.');
      return { error: 'Server returned an HTML error page.' };
    }
    throw err;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
