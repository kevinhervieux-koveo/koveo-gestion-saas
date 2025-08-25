import { renderHook, act } from '@testing-library/react';
import { useFullscreen } from '@/hooks/use-fullscreen';

// Mock the fullscreen API
const mockRequestFullscreen = jest.fn();
const mockExitFullscreen = jest.fn();

Object.defineProperty(document, 'documentElement', {
  _value: {
    requestFullscreen: mockRequestFullscreen,
  },
  writable: true,
});

Object.defineProperty(document, 'exitFullscreen', {
  _value: mockExitFullscreen,
  writable: true,
});

Object.defineProperty(document, 'fullscreenElement', {
  _value: null,
  writable: true,
});

describe('useFullscreen Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fullscreen state
    Object.defineProperty(document, 'fullscreenElement', {
      _value: null,
      writable: true,
    });
  });

  describe('Initial State', () => {
    it('returns false for isFullscreen initially', () => {
      const { result } = renderHook(() => useFullscreen());

      expect(result.current.isFullscreen).toBe(false);
    });

    it('provides toggleFullscreen function', () => {
      const { result } = renderHook(() => useFullscreen());

      expect(typeof result.current.toggleFullscreen).toBe('function');
    });

    it('provides enterFullscreen and exitFullscreen functions', () => {
      const { result } = renderHook(() => useFullscreen());

      expect(typeof result.current.enterFullscreen).toBe('function');
      expect(typeof result.current.exitFullscreen).toBe('function');
    });
  });

  describe('Entering Fullscreen', () => {
    it('calls requestFullscreen when toggling from windowed mode', async () => {
      mockRequestFullscreen.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.toggleFullscreen();
      });

      expect(mockRequestFullscreen).toHaveBeenCalled();
    });

    it('calls requestFullscreen when explicitly entering fullscreen', async () => {
      mockRequestFullscreen.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(mockRequestFullscreen).toHaveBeenCalled();
    });

    it('handles requestFullscreen errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockRequestFullscreen.mockRejectedValue(new Error('Fullscreen not allowed'));

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(consoleError).toHaveBeenCalledWith('Error entering fullscreen:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('Exiting Fullscreen', () => {
    beforeEach(() => {
      // Mock fullscreen state
      Object.defineProperty(document, 'fullscreenElement', {
        _value: document.documentElement,
        writable: true,
      });
    });

    it('calls exitFullscreen when toggling from fullscreen mode', async () => {
      mockExitFullscreen.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.toggleFullscreen();
      });

      expect(mockExitFullscreen).toHaveBeenCalled();
    });

    it('calls exitFullscreen when explicitly exiting fullscreen', async () => {
      mockExitFullscreen.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(mockExitFullscreen).toHaveBeenCalled();
    });

    it('handles exitFullscreen errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockExitFullscreen.mockRejectedValue(new Error('Exit fullscreen failed'));

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(consoleError).toHaveBeenCalledWith('Error exiting fullscreen:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('Fullscreen State Detection', () => {
    it('updates isFullscreen when fullscreen state changes', () => {
      const { result } = renderHook(() => useFullscreen());

      // Simulate entering fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        _value: document.documentElement,
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it('handles webkit fullscreen change events', () => {
      const { result } = renderHook(() => useFullscreen());

      Object.defineProperty(document, 'fullscreenElement', {
        _value: document.documentElement,
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('webkitfullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it('handles mozilla fullscreen change events', () => {
      const { result } = renderHook(() => useFullscreen());

      Object.defineProperty(document, 'fullscreenElement', {
        _value: document.documentElement,
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('mozfullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it('handles IE fullscreen change events', () => {
      const { result } = renderHook(() => useFullscreen());

      Object.defineProperty(document, 'fullscreenElement', {
        _value: document.documentElement,
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('MSFullscreenChange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });
  });

  describe('Cross-browser Compatibility', () => {
    it('does not call enterFullscreen if already in fullscreen', async () => {
      Object.defineProperty(document, 'fullscreenElement', {
        _value: document.documentElement,
        writable: true,
      });

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(mockRequestFullscreen).not.toHaveBeenCalled();
    });

    it('does not call exitFullscreen if not in fullscreen', async () => {
      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(mockExitFullscreen).not.toHaveBeenCalled();
    });
  });

  describe('Event Cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListener = jest.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useFullscreen());

      unmount();

      expect(removeEventListener).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith(
        'webkitfullscreenchange',
        expect.any(Function)
      );
      expect(removeEventListener).toHaveBeenCalledWith('mozfullscreenchange', expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith('MSFullscreenChange', expect.any(Function));

      removeEventListener.mockRestore();
    });
  });
});
