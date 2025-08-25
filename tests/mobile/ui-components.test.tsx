import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mobile viewport setup
const setupMobileViewport = () => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    _value: 375,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    _value: 667,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('Mobile UI Components Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    setupMobileViewport();
  });

  describe('Mobile Button Components', () => {
    it('should render buttons with adequate touch targets', () => {
      const { Button } = require('../../client/src/components/ui/button');

      render(
        <div className='p-4 space-y-4'>
          <Button size='default' className='min-h-[44px] w-full'>
            Submit Maintenance Request
          </Button>
          <Button size='sm' className='min-h-[44px] min-w-[44px]'>
            Save
          </Button>
          <Button variant='outline' className='min-h-[44px] px-6'>
            Cancel Request
          </Button>
        </div>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);

      buttons.forEach((button) => {
        expect(button).toHaveClass(/min-h-\[44px\]/);
      });

      expect(screen.getByText('Submit Maintenance Request')).toHaveClass('w-full');
    });

    it('should handle touch events properly', async () => {
      const mockClick = jest.fn();
      const { Button } = require('../../client/src/components/ui/button');

      render(
        <Button onClick={mockClick} className='min-h-[44px] touch-manipulation'>
          Add Property
        </Button>
      );

      const button = screen.getByText('Add Property');

      // Test touch events
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);

      await user.click(button);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Mobile Form Components', () => {
    it('should render mobile-optimized input fields', () => {
      const { Input } = require('../../client/src/components/ui/input');
      const { Label } = require('../../client/src/components/ui/label');

      render(
        <form className='p-4 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='property-name'>Property Name</Label>
            <Input
              id='property-name'
              type='text'
              placeholder='Enter property name'
              className='text-base min-h-[44px]' // Prevents zoom on iOS
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='tenant-email'>Tenant Email</Label>
            <Input
              id='tenant-email'
              type='email'
              placeholder='tenant@example.com'
              className='text-base min-h-[44px]'
            />
          </div>
        </form>
      );

      const propertyInput = screen.getByLabelText('Property Name');
      const emailInput = screen.getByLabelText('Tenant Email');

      expect(propertyInput).toHaveClass('text-base');
      expect(propertyInput).toHaveClass('min-h-[44px]');
      expect(emailInput).toHaveClass('text-base');
      expect(emailInput).toHaveClass('min-h-[44px]');
    });

    it('should provide proper keyboard navigation', async () => {
      const { Input } = require('../../client/src/components/ui/input');
      const { Button } = require('../../client/src/components/ui/button');

      render(
        <form className='p-4 space-y-4'>
          <Input placeholder='First name' />
          <Input placeholder='Last name' />
          <Input placeholder='Email address' />
          <Button type='submit'>Submit</Button>
        </form>
      );

      // Test tab navigation
      await user.tab();
      expect(screen.getByPlaceholderText('First name')).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText('Last name')).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText('Email address')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Submit')).toHaveFocus();
    });
  });

  describe('Mobile Card Components', () => {
    it('should render property cards with mobile layout', () => {
      const {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
      } = require('../../client/src/components/ui/card');

      render(
        <div className='grid gap-4 p-4'>
          <Card className='w-full'>
            <CardHeader>
              <CardTitle>Maple Heights Condos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                <p className='text-sm text-gray-600'>24 units • Montreal, QC</p>
                <p className='text-sm'>Monthly fees: $450</p>
                <div className='flex gap-2 mt-4'>
                  <button className='flex-1 py-2 bg-blue-600 text-white rounded text-sm'>
                    View Details
                  </button>
                  <button className='flex-1 py-2 border border-gray-300 rounded text-sm'>
                    Edit Property
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );

      expect(screen.getByText('Maple Heights Condos')).toBeInTheDocument();
      expect(screen.getByText('24 units • Montreal, QC')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Edit Property')).toBeInTheDocument();
    });

    it('should handle card interactions on mobile', async () => {
      const mockViewDetails = jest.fn();
      const mockEditProperty = jest.fn();

      render(
        <div className='p-4'>
          <div className='border rounded-lg p-4 touch-manipulation'>
            <h3 className='font-semibold'>Oak Gardens Apartments</h3>
            <p className='text-sm text-gray-600'>18 units • Quebec City, QC</p>
            <div className='flex gap-2 mt-4'>
              <button
                onClick={mockViewDetails}
                className='flex-1 py-2 bg-blue-600 text-white rounded text-sm min-h-[44px]'
              >
                View Details
              </button>
              <button
                onClick={mockEditProperty}
                className='flex-1 py-2 border border-gray-300 rounded text-sm min-h-[44px]'
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      );

      const viewButton = screen.getByText('View Details');
      const editButton = screen.getByText('Edit');

      await user.click(viewButton);
      expect(mockViewDetails).toHaveBeenCalled();

      await user.click(editButton);
      expect(mockEditProperty).toHaveBeenCalled();
    });
  });

  describe('Mobile Navigation Components', () => {
    it('should render mobile-friendly navigation', () => {
      const { Button } = require('../../client/src/components/ui/button');

      render(
        <nav className='border-b p-4'>
          <div className='flex items-center justify-between'>
            <Button variant='ghost' size='sm' className='md:hidden'>
              ☰
            </Button>
            <h1 className='text-lg font-semibold'>Koveo Gestion</h1>
            <Button variant='ghost' size='sm'>
              👤
            </Button>
          </div>
        </nav>
      );

      const menuButton = screen.getByText('☰');
      const profileButton = screen.getByText('👤');
      const title = screen.getByText('Koveo Gestion');

      expect(menuButton).toBeInTheDocument();
      expect(menuButton).toHaveClass('md:hidden');
      expect(profileButton).toBeInTheDocument();
      expect(title).toBeInTheDocument();
    });

    it('should provide bottom navigation for mobile', () => {
      const { Button } = require('../../client/src/components/ui/button');

      render(
        <div className='fixed bottom-0 left-0 right-0 bg-white border-t p-2'>
          <div className='flex justify-around'>
            <Button variant='ghost' size='sm' className='flex flex-col items-center p-2'>
              <span className='text-lg'>🏠</span>
              <span className='text-xs'>Home</span>
            </Button>
            <Button variant='ghost' size='sm' className='flex flex-col items-center p-2'>
              <span className='text-lg'>🏢</span>
              <span className='text-xs'>Properties</span>
            </Button>
            <Button variant='ghost' size='sm' className='flex flex-col items-center p-2'>
              <span className='text-lg'>🔧</span>
              <span className='text-xs'>Maintenance</span>
            </Button>
            <Button variant='ghost' size='sm' className='flex flex-col items-center p-2'>
              <span className='text-lg'>👤</span>
              <span className='text-xs'>Profile</span>
            </Button>
          </div>
        </div>
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Properties')).toBeInTheDocument();
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });

  describe('Mobile List Components', () => {
    it('should render maintenance requests list for mobile', () => {
      const maintenanceRequests = [
        { id: 1, title: 'Leaky faucet in Unit 4B', status: 'Open', priority: 'High' },
        { id: 2, title: 'Broken light in hallway', status: 'In Progress', priority: 'Medium' },
        { id: 3, title: 'AC not working in Unit 2A', status: 'Completed', priority: 'High' },
      ];

      render(
        <div className='p-4'>
          <h2 className='text-lg font-semibold mb-4'>Maintenance Requests</h2>
          <div className='space-y-3'>
            {maintenanceRequests.map((request) => (
              <div key={request.id} className='border rounded-lg p-3 touch-manipulation'>
                <div className='flex justify-between items-start'>
                  <div className='flex-1'>
                    <h3 className='font-medium text-sm'>{request.title}</h3>
                    <div className='flex gap-2 mt-1'>
                      <span className='text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded'>
                        {request.status}
                      </span>
                      <span className='text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded'>
                        {request.priority}
                      </span>
                    </div>
                  </div>
                  <button className='text-gray-400 p-1'>→</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

      expect(screen.getByText('Maintenance Requests')).toBeInTheDocument();
      expect(screen.getByText('Leaky faucet in Unit 4B')).toBeInTheDocument();
      expect(screen.getByText('Broken light in hallway')).toBeInTheDocument();
      expect(screen.getByText('AC not working in Unit 2A')).toBeInTheDocument();

      // Check status badges
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should handle list item selection on mobile', async () => {
      const mockSelectItem = jest.fn();

      const items = ['Unit 4B', 'Unit 2A', 'Unit 3C'];

      render(
        <div className='p-4'>
          <div className='space-y-2'>
            {items.map((item) => (
              <button
                key={item}
                onClick={() => mockSelectItem(item)}
                className='w-full text-left p-3 border rounded-lg touch-manipulation hover:bg-gray-50'
              >
                <div className='font-medium'>{item}</div>
                <div className='text-sm text-gray-600'>Apartment unit</div>
              </button>
            ))}
          </div>
        </div>
      );

      const unit4B = screen.getByText('Unit 4B');
      await user.click(unit4B);

      expect(mockSelectItem).toHaveBeenCalledWith('Unit 4B');
    });
  });

  describe('Mobile Table Components', () => {
    it('should render responsive tables with horizontal scroll', () => {
      const {
        Table,
        TableHeader,
        TableBody,
        TableRow,
        TableHead,
        TableCell,
      } = require('../../client/src/components/ui/table');

      render(
        <div className='p-4'>
          <div className='overflow-x-auto'>
            <Table className='min-w-full'>
              <TableHeader>
                <TableRow>
                  <TableHead className='min-w-[120px]'>Property</TableHead>
                  <TableHead className='min-w-[80px]'>Units</TableHead>
                  <TableHead className='min-w-[100px]'>Monthly Fee</TableHead>
                  <TableHead className='min-w-[80px]'>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Maple Heights</TableCell>
                  <TableCell>24</TableCell>
                  <TableCell>$450</TableCell>
                  <TableCell>Active</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Oak Gardens</TableCell>
                  <TableCell>18</TableCell>
                  <TableCell>$380</TableCell>
                  <TableCell>Active</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      );

      expect(screen.getByText('Property')).toBeInTheDocument();
      expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      expect(screen.getByText('Oak Gardens')).toBeInTheDocument();

      const table = screen.getByRole('table');
      expect(table).toHaveClass('min-w-full');
    });
  });

  describe('Mobile Floating Action Button', () => {
    it('should render FAB with quick actions', async () => {
      const { Button } = require('../../client/src/components/ui/button');

      const FABComponent = () => {
        const [showMenu, setShowMenu] = React.useState(false);

        return (
          <div className='relative'>
            <Button
              onClick={() => setShowMenu(!showMenu)}
              className='fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50'
              size='lg'
            >
              +
            </Button>

            {showMenu && (
              <div className='fixed bottom-36 right-4 bg-white rounded-lg shadow-lg p-2 z-50'>
                <div className='space-y-2'>
                  <button className='w-full text-left p-2 hover:bg-gray-100 rounded text-sm'>
                    📋 New Maintenance Request
                  </button>
                  <button className='w-full text-left p-2 hover:bg-gray-100 rounded text-sm'>
                    🏢 Add Property
                  </button>
                  <button className='w-full text-left p-2 hover:bg-gray-100 rounded text-sm'>
                    👤 Add Resident
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<FABComponent />);

      const fabButton = screen.getByText('+');
      expect(fabButton).toBeInTheDocument();
      expect(fabButton).toHaveClass('fixed');
      expect(fabButton).toHaveClass('rounded-full');

      await user.click(fabButton);

      await waitFor(() => {
        expect(screen.getByText('📋 New Maintenance Request')).toBeInTheDocument();
        expect(screen.getByText('🏢 Add Property')).toBeInTheDocument();
        expect(screen.getByText('👤 Add Resident')).toBeInTheDocument();
      });
    });
  });
});
