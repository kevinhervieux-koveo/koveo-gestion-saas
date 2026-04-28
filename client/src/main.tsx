import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', () => {
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(<App />);

if (!import.meta.env.PROD) {
  const s = document.createElement('script');
  s.src = 'https://replit.com/public/js/replit-dev-banner.js';
  document.body.appendChild(s);
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failure should not break the app */
    });
  });
}
