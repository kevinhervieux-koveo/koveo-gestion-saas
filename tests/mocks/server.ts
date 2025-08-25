import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup request mocking server for Node environment
export const server = setupServer(...handlers);