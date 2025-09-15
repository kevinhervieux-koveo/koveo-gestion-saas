// Mock for wouter router to prevent ES module import issues
const React = require('react');

const Router = ({ children }) => React.createElement('div', { 'data-testid': 'router' }, children);

const Link = ({ href, children, ...props }) => 
  React.createElement('a', { href, ...props, 'data-testid': 'link' }, children);

const useLocation = () => ['/', () => {}];

const useRoute = () => [false, {}];

const useRouter = () => ({
  navigate: jest.fn(),
  location: '/',
});

module.exports = {
  Router,
  Link,
  useLocation,
  useRoute,
  useRouter,
  __esModule: true,
  default: {
    Router,
    Link,
    useLocation,
    useRoute,
    useRouter,
  }
};