// Mock implementation for wouter routing library
const React = require('react');

// Mock Router component
const Router = ({ children }) => React.createElement('div', null, children);

// Mock BrowserRouter component  
const BrowserRouter = ({ children }) => React.createElement('div', null, children);

// Mock Link component
const Link = ({ href, children, ...props }) => 
  React.createElement('a', { href, ...props }, children);

// Mock useLocation hook
const useLocation = () => ['/', () => {}];

// Mock useRouter hook
const useRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
});

// Mock useRoute hook
const useRoute = (pattern) => [false, {}];

// Mock useParams hook
const useParams = () => ({});

// Mock Redirect component
const Redirect = ({ to }) => null;

// Mock Switch component
const Switch = ({ children }) => React.createElement('div', null, children);

// Mock Route component
const Route = ({ path, component: Component, ...props }) => {
  if (Component) {
    return React.createElement(Component, props);
  }
  return React.createElement('div', null, props.children);
};

module.exports = {
  Router,
  BrowserRouter,
  Link,
  useLocation,
  useRouter,
  useRoute,
  useParams,
  Redirect,
  Switch,
  Route,
  default: {
    Router,
    BrowserRouter,
    Link,
    useLocation,
    useRouter,
    useRoute,
    useParams,
    Redirect,
    Switch,
    Route
  }
};