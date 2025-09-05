/**
 * @file Demand Comment Form Frontend Tests
 * @description Tests for comment submission form components and validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the hooks and utils
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock queryClient
const createMockQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Mock data
const mockDemand = {
  id: 'demand-123',
  type: 'maintenance',
  description: 'Test demand',
  status: 'submitted',
  submitterId: 'user-123',
};

const mockUser = {
  id: 'user-123',
  role: 'resident',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
};

const mockExistingComments = [
  {
    id: 'comment-1',
    demandId: 'demand-123',
    commentText: 'First comment on this demand',
    commenterId: 'user-123',
    isInternal: false,
    createdAt: '2023-01-01T10:00:00Z',
    author: {
      id: 'user-123',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    },
  },
  {
    id: 'comment-2',
    demandId: 'demand-123',
    commentText: 'Second comment with more details',
    commenterId: 'user-456',
    isInternal: false,
    createdAt: '2023-01-01T11:00:00Z',
    author: {
      id: 'user-456',
      firstName: 'Other',
      lastName: 'User',
      email: 'other@example.com',
    },
  },
];

// Test component that includes comment functionality
const TestCommentForm = ({ demandId, onCommentAdded }: { demandId: string; onCommentAdded?: () => void }) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [comments, setComments] = React.useState(mockExistingComments);
  const [commentText, setCommentText] = React.useState('');
  const [commentType, setCommentType] = React.useState('');
  const [isInternal, setIsInternal] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/demands/${demandId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: commentText.trim(),
          commentType: commentType || undefined,
          isInternal,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create comment');
      }

      const newComment = await response.json();
      setComments(prev => [...prev, newComment]);
      setCommentText('');
      setCommentType('');
      setIsInternal(false);
      onCommentAdded?.();
    } catch (error) {
      console.error('Comment submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-testid="comment-section">
      {/* Display existing comments */}
      <div data-testid="comments-list">
        {comments.map((comment) => (
          <div key={comment.id} data-testid={`comment-${comment.id}`} className="comment">
            <div data-testid={`comment-author-${comment.id}`}>
              {comment.author.firstName} {comment.author.lastName}
            </div>
            <div data-testid={`comment-text-${comment.id}`}>{comment.commentText}</div>
            <div data-testid={`comment-date-${comment.id}`}>{comment.createdAt}</div>
            {comment.isInternal && <div data-testid={`comment-internal-${comment.id}`}>Internal</div>}
          </div>
        ))}
      </div>

      {/* Comment submission form */}
      <form data-testid="comment-form" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="commentText">Comment</label>
          <textarea
            data-testid="input-comment-text"
            id="commentText"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add your comment here..."
            required
            minLength={1}
            maxLength={1000}
            rows={4}
          />
        </div>

        <div>
          <label htmlFor="commentType">Comment Type (Optional)</label>
          <select
            data-testid="input-comment-type"
            id="commentType"
            value={commentType}
            onChange={(e) => setCommentType(e.target.value)}
          >
            <option value="">Select Type</option>
            <option value="update">Update</option>
            <option value="question">Question</option>
            <option value="answer">Answer</option>
            <option value="status_change">Status Change</option>
            <option value="internal_note">Internal Note</option>
          </select>
        </div>

        <div>
          <label>
            <input
              data-testid="input-is-internal"
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
            />
            Internal Comment (visible to staff only)
          </label>
        </div>

        <button
          type="submit"
          data-testid="button-submit-comment"
          disabled={isSubmitting || commentText.trim().length === 0}
        >
          {isSubmitting ? 'Adding Comment...' : 'Add Comment'}
        </button>
      </form>
    </div>
  );
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createMockQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('Demand Comment Form Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Comment Display', () => {
    it('should display existing comments', () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      expect(screen.getByTestId('comments-list')).toBeInTheDocument();
      expect(screen.getByTestId('comment-comment-1')).toBeInTheDocument();
      expect(screen.getByTestId('comment-comment-2')).toBeInTheDocument();

      // Check comment content
      expect(screen.getByTestId('comment-text-comment-1')).toHaveTextContent('First comment on this demand');
      expect(screen.getByTestId('comment-text-comment-2')).toHaveTextContent('Second comment with more details');

      // Check author information
      expect(screen.getByTestId('comment-author-comment-1')).toHaveTextContent('Test User');
      expect(screen.getByTestId('comment-author-comment-2')).toHaveTextContent('Other User');
    });

    it('should display comment timestamps', () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      expect(screen.getByTestId('comment-date-comment-1')).toHaveTextContent('2023-01-01T10:00:00Z');
      expect(screen.getByTestId('comment-date-comment-2')).toHaveTextContent('2023-01-01T11:00:00Z');
    });
  });

  describe('Comment Form Rendering', () => {
    it('should render all form fields', () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      expect(screen.getByTestId('comment-form')).toBeInTheDocument();
      expect(screen.getByTestId('input-comment-text')).toBeInTheDocument();
      expect(screen.getByTestId('input-comment-type')).toBeInTheDocument();
      expect(screen.getByTestId('input-is-internal')).toBeInTheDocument();
      expect(screen.getByTestId('button-submit-comment')).toBeInTheDocument();
    });

    it('should render comment type options', () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-comment-type');
      expect(typeSelect).toHaveTextContent('Update');
      expect(typeSelect).toHaveTextContent('Question');
      expect(typeSelect).toHaveTextContent('Answer');
      expect(typeSelect).toHaveTextContent('Status Change');
      expect(typeSelect).toHaveTextContent('Internal Note');
    });

    it('should have proper form field attributes', () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      expect(textArea).toHaveAttribute('required');
      expect(textArea).toHaveAttribute('minLength', '1');
      expect(textArea).toHaveAttribute('maxLength', '1000');
      expect(textArea).toHaveAttribute('rows', '4');
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when comment text is empty', () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const submitButton = screen.getByTestId('button-submit-comment');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when comment text is provided', async () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, 'This is a valid comment');
      
      expect(submitButton).not.toBeDisabled();
    });

    it('should require comment text field', async () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const submitButton = screen.getByTestId('button-submit-comment');
      
      // Try to submit without text
      await userEvent.click(submitButton);
      
      // Form validation should prevent submission
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle minimum and maximum text length', async () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');

      // Test single character (minimum)
      await userEvent.clear(textArea);
      await userEvent.type(textArea, 'A');
      expect(textArea).toHaveValue('A');

      // Test maximum length (1000 characters)
      const maxText = 'A'.repeat(1000);
      await userEvent.clear(textArea);
      await userEvent.type(textArea, maxText);
      expect(textArea).toHaveValue(maxText);
    });
  });

  describe('Form Submission', () => {
    it('should submit comment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'comment-3',
          demandId: 'demand-123',
          commentText: 'New test comment',
          commenterId: 'user-123',
          isInternal: false,
          createdAt: '2023-01-01T12:00:00Z',
        }),
      });

      const onCommentAdded = jest.fn();
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" onCommentAdded={onCommentAdded} />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, 'New test comment');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands/demand-123/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: 'New test comment',
          commentType: undefined,
          isInternal: false,
        }),
      });

      await waitFor(() => {
        expect(onCommentAdded).toHaveBeenCalled();
      });
    });

    it('should submit comment with optional fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'comment-3',
          demandId: 'demand-123',
          commentText: 'Internal update comment',
          commentType: 'status_change',
          commenterId: 'user-123',
          isInternal: true,
          createdAt: '2023-01-01T12:00:00Z',
        }),
      });

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const typeSelect = screen.getByTestId('input-comment-type');
      const internalCheckbox = screen.getByTestId('input-is-internal');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, 'Internal update comment');
      await userEvent.selectOptions(typeSelect, 'status_change');
      await userEvent.click(internalCheckbox);
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands/demand-123/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: 'Internal update comment',
          commentType: 'status_change',
          isInternal: true,
        }),
      });
    });

    it('should show loading state during submission', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 100)
          )
      );

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, 'Loading test comment');
      await userEvent.click(submitButton);

      expect(submitButton).toHaveTextContent('Adding Comment...');
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(submitButton).toHaveTextContent('Add Comment');
        expect(submitButton).toBeDisabled(); // Should be disabled because textarea is now empty
      });
    });

    it('should clear form after successful submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'comment-3',
          demandId: 'demand-123',
          commentText: 'Test comment for clearing',
          commenterId: 'user-123',
          isInternal: false,
          createdAt: '2023-01-01T12:00:00Z',
        }),
      });

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const typeSelect = screen.getByTestId('input-comment-type');
      const internalCheckbox = screen.getByTestId('input-is-internal');
      const submitButton = screen.getByTestId('button-submit-comment');

      // Fill form
      await userEvent.type(textArea, 'Test comment for clearing');
      await userEvent.selectOptions(typeSelect, 'update');
      await userEvent.click(internalCheckbox);
      await userEvent.click(submitButton);

      // Wait for form to clear
      await waitFor(() => {
        expect(textArea).toHaveValue('');
        expect(typeSelect).toHaveValue('');
        expect(internalCheckbox).not.toBeChecked();
      });
    });

    it('should handle submission errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, 'Error test comment');
      await userEvent.click(submitButton);

      await waitFor(() => {
        // Form should still be visible with the text after error
        expect(textArea).toHaveValue('Error test comment');
        expect(submitButton).toHaveTextContent('Add Comment');
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should handle server validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Comment text too long' }),
      });

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, 'Server error test comment');
      await userEvent.click(submitButton);

      await waitFor(() => {
        // Form should remain with the text after server error
        expect(textArea).toHaveValue('Server error test comment');
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Special Characters and Internationalization', () => {
    it('should handle French characters in comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'comment-3',
          demandId: 'demand-123',
          commentText: 'Commentaire en français avec caractères spéciaux: éàùç!',
          commenterId: 'user-123',
          isInternal: false,
          createdAt: '2023-01-01T12:00:00Z',
        }),
      });

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, 'Commentaire en français avec caractères spéciaux: éàùç!');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands/demand-123/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: 'Commentaire en français avec caractères spéciaux: éàùç!',
          commentType: undefined,
          isInternal: false,
        }),
      });
    });

    it('should handle emojis and special symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'comment-3',
          demandId: 'demand-123',
          commentText: 'Great work! 👍 Thanks @#$%^&*()',
          commenterId: 'user-123',
          isInternal: false,
          createdAt: '2023-01-01T12:00:00Z',
        }),
      });

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, 'Great work! 👍 Thanks @#$%^&*()');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands/demand-123/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: 'Great work! 👍 Thanks @#$%^&*()',
          commentType: undefined,
          isInternal: false,
        }),
      });
    });

    it('should handle multiline comments', async () => {
      const multilineText = `This is a multiline comment.

It has multiple paragraphs.

End of comment.`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'comment-3',
          demandId: 'demand-123',
          commentText: multilineText,
          commenterId: 'user-123',
          isInternal: false,
          createdAt: '2023-01-01T12:00:00Z',
        }),
      });

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, multilineText);
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands/demand-123/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: multilineText,
          commentType: undefined,
          isInternal: false,
        }),
      });
    });
  });

  describe('Form Behavior and UX', () => {
    it('should trim whitespace from comment text before submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'comment-3',
          demandId: 'demand-123',
          commentText: 'Trimmed comment',
          commenterId: 'user-123',
          isInternal: false,
          createdAt: '2023-01-01T12:00:00Z',
        }),
      });

      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const textArea = screen.getByTestId('input-comment-text');
      const submitButton = screen.getByTestId('button-submit-comment');

      await userEvent.type(textArea, '   Trimmed comment   ');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands/demand-123/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: 'Trimmed comment',
          commentType: undefined,
          isInternal: false,
        }),
      });
    });

    it('should handle all comment types correctly', async () => {
      const commentTypes = ['update', 'question', 'answer', 'status_change', 'internal_note'];
      
      for (const type of commentTypes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: `comment-${type}`,
            demandId: 'demand-123',
            commentText: `Comment of type ${type}`,
            commentType: type,
            commenterId: 'user-123',
            isInternal: false,
            createdAt: '2023-01-01T12:00:00Z',
          }),
        });

        render(
          <TestWrapper>
            <TestCommentForm demandId="demand-123" />
          </TestWrapper>
        );

        const textArea = screen.getByTestId('input-comment-text');
        const typeSelect = screen.getByTestId('input-comment-type');
        const submitButton = screen.getByTestId('button-submit-comment');

        await userEvent.type(textArea, `Comment of type ${type}`);
        await userEvent.selectOptions(typeSelect, type);
        await userEvent.click(submitButton);

        expect(mockFetch).toHaveBeenCalledWith('/api/demands/demand-123/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            commentText: `Comment of type ${type}`,
            commentType: type,
            isInternal: false,
          }),
        });

        mockFetch.mockClear();
      }
    });

    it('should handle internal comment toggle correctly', async () => {
      render(
        <TestWrapper>
          <TestCommentForm demandId="demand-123" />
        </TestWrapper>
      );

      const internalCheckbox = screen.getByTestId('input-is-internal');

      // Initially unchecked
      expect(internalCheckbox).not.toBeChecked();

      // Click to check
      await userEvent.click(internalCheckbox);
      expect(internalCheckbox).toBeChecked();

      // Click to uncheck
      await userEvent.click(internalCheckbox);
      expect(internalCheckbox).not.toBeChecked();
    });
  });
});