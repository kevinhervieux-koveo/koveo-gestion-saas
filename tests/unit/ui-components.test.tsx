import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '../../client/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/src/components/ui/card';
import { Badge } from '../../client/src/components/ui/badge';
import { Checkbox } from '../../client/src/components/ui/checkbox';
import { Switch } from '../../client/src/components/ui/switch';
import { Label } from '../../client/src/components/ui/label';
import { Input } from '../../client/src/components/ui/input';

describe('UI Components Tests', () => {
  describe('Button Component', () => {
    it('should render button with text', () => {
      render(<Button>Click me</Button>);

      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('should handle click events', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should support different variants', () => {
      render(<Button variant='destructive'>Delete</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-destructive');
    });

    it('should support different sizes', () => {
      render(<Button size='sm'>Small Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Card Component', () => {
    it('should render card with header and content', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
        </Card>
      );

      expect(screen.getByText('Card Title')).toBeInTheDocument();
      expect(screen.getByText('Card content goes here')).toBeInTheDocument();
    });

    it('should have proper card styling', () => {
      render(
        <Card data-testid='card'>
          <CardContent>Content</CardContent>
        </Card>
      );

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card');
    });

    it('should render header with correct styling', () => {
      render(
        <Card>
          <CardHeader data-testid='card-header'>
            <CardTitle>Title</CardTitle>
          </CardHeader>
        </Card>
      );

      const header = screen.getByTestId('card-header');
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6');
    });
  });

  describe('Badge Component', () => {
    it('should render badge with text', () => {
      render(<Badge>New</Badge>);

      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('should support different variants', () => {
      render(<Badge variant='destructive'>Error</Badge>);

      const badge = screen.getByText('Error');
      expect(badge).toHaveClass('bg-destructive');
    });

    it('should support secondary variant', () => {
      render(<Badge variant='secondary'>Secondary</Badge>);

      const badge = screen.getByText('Secondary');
      expect(badge).toHaveClass('bg-secondary');
    });
  });

  describe('Checkbox Component', () => {
    it('should render checkbox', () => {
      render(<Checkbox data-testid='checkbox' />);

      expect(screen.getByTestId('checkbox')).toBeInTheDocument();
    });

    it('should handle checked state', () => {
      const handleChange = jest.fn();
      render(<Checkbox checked={true} onCheckedChange={handleChange} data-testid='checkbox' />);

      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should handle click events', () => {
      const handleChange = jest.fn();
      render(<Checkbox onCheckedChange={handleChange} data-testid='checkbox' />);

      fireEvent.click(screen.getByTestId('checkbox'));
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Switch Component', () => {
    it('should render switch', () => {
      render(<Switch data-testid='switch' />);

      expect(screen.getByTestId('switch')).toBeInTheDocument();
    });

    it('should handle checked state', () => {
      render(<Switch checked={true} data-testid='switch' />);

      const switchElement = screen.getByTestId('switch');
      expect(switchElement).toBeChecked();
    });

    it('should handle click events', () => {
      const handleChange = jest.fn();
      render(<Switch onCheckedChange={handleChange} data-testid='switch' />);

      fireEvent.click(screen.getByTestId('switch'));
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Label Component', () => {
    it('should render label with text', () => {
      render(<Label>Email Address</Label>);

      expect(screen.getByText('Email Address')).toBeInTheDocument();
    });

    it('should associate with form controls', () => {
      render(
        <div>
          <Label htmlFor='email'>Email</Label>
          <Input id='email' type='email' />
        </div>
      );

      const label = screen.getByText('Email');
      const input = screen.getByRole('textbox');

      expect(label).toHaveAttribute('for', 'email');
      expect(input).toHaveAttribute('id', 'email');
    });
  });

  describe('Input Component', () => {
    it('should render input field', () => {
      render(<Input placeholder='Enter text' />);

      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('should handle different input types', () => {
      render(<Input type='email' data-testid='email-input' />);

      const input = screen.getByTestId('email-input');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should handle value changes', () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} data-testid='input' />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'test value' } });

      expect(handleChange).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Input disabled data-testid='input' />);

      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
    });

    it('should have proper styling classes', () => {
      render(<Input data-testid='input' />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md', 'border');
    });
  });

  describe('Form Components Integration', () => {
    it('should work together in a form structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>User Form</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <div>
                <Label htmlFor='username'>Username</Label>
                <Input id='username' placeholder='Enter username' />
              </div>
              <div className='flex items-center space-x-2'>
                <Checkbox id='terms' />
                <Label htmlFor='terms'>Accept terms</Label>
              </div>
              <div className='flex items-center space-x-2'>
                <Switch id='notifications' />
                <Label htmlFor='notifications'>Enable notifications</Label>
              </div>
              <Button type='submit'>Submit</Button>
            </div>
          </CardContent>
        </Card>
      );

      // Verify all components render together
      expect(screen.getByText('User Form')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Accept terms')).toBeInTheDocument();
      expect(screen.getByLabelText('Enable notifications')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });
  });
});
