// Mock for wouter router to prevent ES module issues

const React = require('react');

// Mock Router component
const Router = ({ children }) => {
  return React.createElement('div', { 'data-testid': 'mock-router' }, children);
};

// Mock Link component
const Link = ({ href, children, ...props }) => {
  return React.createElement('a', { href, ...props }, children);
};

// Mock hooks
const useLocation = () => ['/mock-path', () => {}];
const useRoute = () => [true, {}];
const useRouter = () => ({
  push: () => {},
  replace: () => {},
});

module.exports = {
  Router,
  Link,
  useLocation,
  useRoute,
  useRouter,
  Route: ({ path, component, children }) => {
    if (typeof component === 'function') {
      return React.createElement(component);
    }
    return children || null;
  },
  Switch: ({ children }) => children,
  Redirect: () => null,
};