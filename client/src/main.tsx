import { createRoot } from 'react-dom/client';
// import App from './App';
import TestApp from './App.test';
import './index.css';

// Temporarily use test app to debug rendering issues
createRoot(document.getElementById('root')!).render(<TestApp />);
