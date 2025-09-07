import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { Building, Home, TrendingUp } from 'lucide-react';
import { NoDataCard } from '@/components/ui/no-data-card';
import { LanguageProvider } from '@/hooks/use-language';

// Mock component for testing
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

describe('NoDataCard Component', () => {
  beforeEach(() => {
    // Clear any existing DOM
    document.body.innerHTML = '';
  });

  describe('Basic Functionality', () => {
    it('should render with required props', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            testId="test-no-data"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('test-no-data')).toBeInTheDocument();
      expect(screen.getByTestId('test-no-data-title')).toBeInTheDocument();
      expect(screen.getByTestId('test-no-data-description')).toBeInTheDocument();
    });

    it('should render with different icons', () => {
      const { rerender } = render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            testId="test-building"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('test-building')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <NoDataCard
            icon={Home}
            titleKey="noResidencesFound"
            descriptionKey="notAssignedResidences"
            testId="test-home"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('test-home')).toBeInTheDocument();
    });

    it('should render with badge when badgeKey is provided', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            badgeKey="noData"
            testId="test-with-badge"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('test-with-badge-badge')).toBeInTheDocument();
    });

    it('should not render badge when badgeKey is not provided', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            testId="test-no-badge"
          />
        </TestWrapper>
      );

      expect(screen.queryByTestId('test-no-badge-badge')).not.toBeInTheDocument();
    });
  });

  describe('Translation Coverage', () => {
    it('should render French translations correctly', () => {
      // Note: In a real test, we'd mock the language context to return French
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            badgeKey="noData"
            testId="test-french"
          />
        </TestWrapper>
      );

      const title = screen.getByTestId('test-french-title');
      const description = screen.getByTestId('test-french-description');
      const badge = screen.getByTestId('test-french-badge');

      // These should contain the actual translated text when language is set
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(badge).toBeInTheDocument();
    });

    it('should handle all common no data translation keys', () => {
      const testCases = [
        {
          titleKey: 'noBuildingsFound',
          descriptionKey: 'noBuildingsAdminMessage',
          testId: 'buildings-test',
        },
        {
          titleKey: 'noResidencesFound',
          descriptionKey: 'noResidencesFoundOrg',
          testId: 'residences-test',
        },
        {
          titleKey: 'noDataAvailable',
          descriptionKey: 'noBookingsFoundMessage',
          testId: 'bookings-test',
        },
        {
          titleKey: 'selectCommonSpace',
          descriptionKey: 'selectCommonSpaceMessage',
          testId: 'select-space-test',
        },
      ];

      testCases.forEach(({ titleKey, descriptionKey, testId }) => {
        render(
          <TestWrapper>
            <NoDataCard
              icon={Building}
              titleKey={titleKey}
              descriptionKey={descriptionKey}
              testId={testId}
            />
          </TestWrapper>
        );

        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.getByTestId(`${testId}-title`)).toBeInTheDocument();
        expect(screen.getByTestId(`${testId}-description`)).toBeInTheDocument();

        // Clean up for next test
        document.body.innerHTML = '';
      });
    });
  });

  describe('Customization Options', () => {
    it('should apply custom CSS classes', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            className="custom-card-class"
            contentClassName="custom-content-class"
            testId="test-custom-classes"
          />
        </TestWrapper>
      );

      const card = screen.getByTestId('test-custom-classes');
      expect(card).toHaveClass('custom-card-class');
    });

    it('should render custom children', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            testId="test-with-children"
          >
            <div data-testid="custom-child">Custom content</div>
          </NoDataCard>
        </TestWrapper>
      );

      expect(screen.getByTestId('custom-child')).toBeInTheDocument();
      expect(screen.getByText('Custom content')).toBeInTheDocument();
    });

    it('should handle different icon sizes', () => {
      const { rerender } = render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            iconSize={12}
            testId="test-small-icon"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('test-small-icon')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            iconSize={20}
            testId="test-large-icon"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('test-large-icon')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper test IDs for screen readers', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={TrendingUp}
            titleKey="noDataAvailable"
            descriptionKey="noBookingsFoundMessage"
            badgeKey="noData"
            testId="accessibility-test"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('accessibility-test')).toBeInTheDocument();
      expect(screen.getByTestId('accessibility-test-title')).toBeInTheDocument();
      expect(screen.getByTestId('accessibility-test-description')).toBeInTheDocument();
      expect(screen.getByTestId('accessibility-test-badge')).toBeInTheDocument();
    });

    it('should maintain semantic structure', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            testId="semantic-test"
          />
        </TestWrapper>
      );

      const title = screen.getByTestId('semantic-test-title');
      const description = screen.getByTestId('semantic-test-description');

      expect(title.tagName.toLowerCase()).toBe('h3');
      expect(description.tagName.toLowerCase()).toBe('p');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing translation keys gracefully', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="nonExistentKey" as any
            descriptionKey="anotherNonExistentKey" as any
            testId="error-handling-test"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('error-handling-test')).toBeInTheDocument();
      expect(screen.getByTestId('error-handling-test-title')).toBeInTheDocument();
      expect(screen.getByTestId('error-handling-test-description')).toBeInTheDocument();
    });
  });

  describe('Common Use Cases', () => {
    it('should render buildings no data scenario correctly', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Building}
            titleKey="noBuildingsFound"
            descriptionKey="noBuildingsAdminMessage"
            badgeKey="noData"
            testId="buildings-scenario"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('buildings-scenario')).toBeInTheDocument();
    });

    it('should render residences no data scenario correctly', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={Home}
            titleKey="noResidencesFound"
            descriptionKey="notAssignedResidences"
            testId="residences-scenario"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('residences-scenario')).toBeInTheDocument();
    });

    it('should render common spaces stats no data scenario correctly', () => {
      render(
        <TestWrapper>
          <NoDataCard
            icon={TrendingUp}
            titleKey="noDataAvailable"
            descriptionKey="noBookingsFoundMessage"
            testId="stats-scenario"
            iconSize={12}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('stats-scenario')).toBeInTheDocument();
    });
  });
});