import { createRoot } from 'react-dom/client';
import App from './App';
import TestApp from './TestApp';
import './index.css';

// Test if React renders at all
console.log('Starting React application...');

// Use TestApp to verify basic React functionality
const useTestMode = window.location.search.includes('test=true');

createRoot(document.getElementById('root')!).render(
  useTestMode ? <TestApp /> : <App />
);
