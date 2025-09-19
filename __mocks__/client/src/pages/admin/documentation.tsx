import React from 'react';

// Mock version of documentation component that doesn't use import.meta.env
const DocumentationMock = () => {
  // Mock isReplit check without using import.meta.env
  const isReplit = 
    typeof window !== 'undefined' && (
      window.location.hostname.includes('replit') ||
      window.location.hostname.includes('.repl.') ||
      process.env.REPLIT_ENV
    );

  return (
    <div data-testid="documentation-page">
      <div data-testid="documentation-content">
        Documentation content
        {isReplit && <div data-testid="replit-specific">Replit environment detected</div>}
      </div>
    </div>
  );
};

export default DocumentationMock;