// Enhanced mock for wouter router with comprehensive hook support
const React = require('react');

// Mock state that can be controlled by tests
let mockLocation = '/';
let mockSearch = '';
let mockParams = {};
let mockNavigateFunction = jest.fn();

// Helpers for tests to control router state
const __setLocation = (location) => {
  mockLocation = location;
};

const __setSearch = (search) => {
  mockSearch = search;
};

const __setParams = (params) => {
  mockParams = params;
};

const __resetMocks = () => {
  mockLocation = '/';
  mockSearch = '';
  mockParams = {};
  mockNavigateFunction.mockClear();
};

// Helper to extract params from a pattern and current location
const extractParams = (pattern, location) => {
  // Simple implementation for common patterns like /users/:id
  if (!pattern || !pattern.includes(':')) return {};
  
  const patternParts = pattern.split('/');
  const locationParts = location.split('/');
  const params = {};
  
  patternParts.forEach((part, index) => {
    if (part.startsWith(':')) {
      const paramName = part.slice(1);
      params[paramName] = locationParts[index] || '';
    }
  });
  
  return params;
};

// Component mocks
const Router = ({ children }) => React.createElement('div', { 'data-testid': 'router' }, children);

const Route = ({ path, component: Component, children, ...props }) => {
  // Simple route matching for tests - always render if component is provided
  if (Component) {
    return React.createElement(Component, props);
  }
  if (children) {
    return React.createElement('div', { 'data-testid': 'route', ...props }, 
      typeof children === 'function' ? children(mockParams) : children
    );
  }
  return null;
};

const Link = ({ href, children, to, ...props }) => {
  const handleClick = (e) => {
    e.preventDefault();
    const destination = to || href;
    if (destination) {
      mockNavigateFunction(destination);
      mockLocation = destination;
    }
  };
  
  return React.createElement('a', { 
    href: to || href, 
    onClick: handleClick,
    'data-testid': 'link',
    ...props 
  }, children);
};

// Hook mocks
const useLocation = () => {
  const navigate = (path, options = {}) => {
    mockNavigateFunction(path, options);
    if (options.replace) {
      mockLocation = path;
    } else {
      mockLocation = path;
    }
  };
  
  return [mockLocation, navigate];
};

const useRoute = (pattern) => {
  // Simple pattern matching for tests
  if (!pattern) return [false, {}];
  
  // Handle exact matches
  if (pattern === mockLocation) {
    return [true, mockParams];
  }
  
  // Handle parameterized routes
  const params = extractParams(pattern, mockLocation);
  const matches = Object.keys(params).length > 0;
  
  return [matches, params];
};

const useParams = (pattern) => {
  // Extract params from current location if pattern is provided
  if (pattern && mockLocation) {
    const params = extractParams(pattern, mockLocation);
    return params;
  }
  return mockParams;
};

const useSearch = () => {
  // Return search params from mock location or fallback to mockSearch
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    return window.location.search;
  }
  return mockSearch;
};

const useRouter = () => ({
  navigate: mockNavigateFunction,
  location: mockLocation,
  search: mockSearch,
  params: mockParams
});

// Navigation hook for programmatic navigation
const useNavigate = () => {
  return (path, options = {}) => {
    mockNavigateFunction(path, options);
    mockLocation = path;
  };
};

// Redirect component
const Redirect = ({ to, href, ...props }) => {
  React.useEffect(() => {
    const destination = to || href;
    if (destination) {
      mockNavigateFunction(destination);
      mockLocation = destination;
    }
  }, [to, href]);
  
  return null;
};

// Switch component for routing
const Switch = ({ children }) => {
  return React.createElement('div', { 'data-testid': 'switch' }, children);
};

// Named exports for Jest/ES6 interop
module.exports.Router = Router;
module.exports.Route = Route;
module.exports.Link = Link;
module.exports.Switch = Switch;
module.exports.Redirect = Redirect;
module.exports.useLocation = useLocation;
module.exports.useRoute = useRoute;
module.exports.useParams = useParams;
module.exports.useSearch = useSearch;
module.exports.useRouter = useRouter;
module.exports.useNavigate = useNavigate;

// Test helpers
module.exports.__setLocation = __setLocation;
module.exports.__setSearch = __setSearch;
module.exports.__setParams = __setParams;
module.exports.__resetMocks = __resetMocks;

// ES module compatibility - set after named exports
module.exports.__esModule = true;

// Default export for require() calls
module.exports.default = {
  Router,
  Route,
  Link,
  Switch,
  Redirect,
  useLocation,
  useRoute,
  useParams,
  useSearch,
  useRouter,
  useNavigate,
  __setLocation,
  __setSearch,
  __setParams,
  __resetMocks
};