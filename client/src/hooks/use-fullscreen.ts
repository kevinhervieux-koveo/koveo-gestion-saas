import { useState, useEffect, useCallback } from 'react';

/**
 *
 */
/**
 * UseFullscreen custom hook.
 * @returns Hook return value.
 */
/**
 * Use fullscreen function.
 */
export function /**
 * Use fullscreen function.
 */ /**
 * Use fullscreen function.
 */

useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    try {
      /**
       * If function.
       * @param !document.fullscreenElement - !document.fullscreenElement parameter.
       */
      /**
       * If function.
       * @param !document.fullscreenElement - !document.fullscreenElement parameter.
       */ /**
       * If function.
       * @param !document.fullscreenElement - !document.fullscreenElement parameter.
       */

      /**
       * If function.
       * @param !document.fullscreenElement - !document.fullscreenElement parameter.
       */

      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (_error) {
      /**
       * Catch function.
       * @param error - Error object.
       */
      /**
       * Catch function.
       * @param error - Error object.
       */
      /**
       * Catch function.
       * @param error - Error object.
       */ /**
       * Catch function.
       * @param error - Error object.
       */

      /**
       * Catch function.
       * @param error - Error object.
       */
      /**
       * Catch function.
       * @param error - Error object.
       */
      console.error('Error toggling fullscreen:', _error);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      /**
       * If function.
       * @param document.fullscreenElement - Document.fullscreenElement parameter.
       */ /**
       * If function.
       * @param document.fullscreenElement - Document.fullscreenElement parameter.
       */

      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (_error) {
      console.error('Error exiting fullscreen:', _error);
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (_error) {
      console.error('Error entering fullscreen:', _error);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  return {
    isFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
