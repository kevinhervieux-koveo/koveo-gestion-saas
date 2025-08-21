import React from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { LanguageProvider, useLanguage } from '../../client/src/hooks/use-language';

/**
 * Test component for language functionality.
 * @returns JSX component for testing language features.
 */
function TestComponent(): JSX.Element {
  const { language, t, setLanguage } = useLanguage();
  
  return (
    <div>
      <span data-testid="current-language">{language}</span>
      <span data-testid="dashboard-text">{t('dashboard')}</span>
      <button 
        onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
        data-testid="language-toggle"
      >
        Toggle Language
      </button>
    </div>
  );
}

describe('Language Provider', () => {
  it('should provide English as default language', () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('current-language')).toHaveTextContent('en');
    expect(screen.getByTestId('dashboard-text')).toHaveTextContent('Dashboard');
  });

  it('should switch to French when language is changed', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    await user.click(screen.getByTestId('language-toggle'));

    expect(screen.getByTestId('current-language')).toHaveTextContent('fr');
    expect(screen.getByTestId('dashboard-text')).toHaveTextContent('Tableau de bord');
  });
});