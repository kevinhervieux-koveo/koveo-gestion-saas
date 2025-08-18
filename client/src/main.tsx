import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

console.log('Starting React application...');

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found');
  }
  console.log('Root element found, creating React root...');
  
  const reactRoot = createRoot(root);
  console.log('React root created, rendering app...');
  
  reactRoot.render(<App />);
  console.log('App rendered successfully');
} catch (error) {
  console.error('Failed to start React application:', error);
  document.body.innerHTML = `
    <div style="padding: 40px; font-family: sans-serif;">
      <h1>Koveo Gestion - Loading Error</h1>
      <p>The application failed to start. Error: ${error.message}</p>
      <p>Please refresh the page or contact support.</p>
    </div>
  `;
}
