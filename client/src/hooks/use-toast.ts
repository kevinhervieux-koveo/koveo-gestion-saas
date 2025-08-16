import * as React from 'react';

import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

/**
 * Extended toast properties that include additional UI state and actions.
 * Combines base ToastProps with unique identifier and React node content.
 */
type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

let count = 0;

/**
 * Generates a unique identifier for toast notifications.
 * Uses an incrementing counter with overflow protection to ensure uniqueness.
 * 
 * @returns {string} Unique string identifier for the toast.
 * @example
 * ```typescript
 * const id = genId(); // Returns '1', '2', '3', etc.
 * ```
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

/**
 * Type definition for all possible toast action types.
 * Derived from the actionTypes constant object.
 */
type ActionType = typeof actionTypes;

/**
 * Union type defining all possible actions that can be dispatched to the toast reducer.
 * Each action type has specific payload requirements for managing toast state.
 */
type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      toastId?: ToasterToast['id'];
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      toastId?: ToasterToast['id'];
    };

/**
 * Application state interface for the toast management system.
 * Contains the array of active toasts being displayed.
 */
interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

/**
 * Dispatches an action to update the toast state and notifies all listeners.
 * Central state management function for the toast system.
 * 
 * @param {Action} action - The action object containing type and payload data.
 * @example
 * ```typescript
 * dispatch({ type: 'ADD_TOAST', toast: newToast });
 * dispatch({ type: 'DISMISS_TOAST', toastId: 'toast-1' });
 * ```
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

/**
 * Toast configuration type without the auto-generated ID field.
 * Used when creating new toasts where ID will be assigned automatically.
 */
type Toast = Omit<ToasterToast, 'id'>;

/**
 * Creates and displays a new toast notification.
 * Automatically generates a unique ID and provides update/dismiss functions.
 * 
 * @param {Toast} props - Toast configuration including title, description, and other display options.
 * @returns {object} Object containing toast ID and control functions (dismiss, update).
 * @example
 * ```typescript
 * const { dismiss, update } = toast({
 *   title: 'Success',
 *   description: 'Operation completed successfully'
 * });
 * 
 * // Later dismiss the toast
 * dismiss();
 * 
 * // Or update its content
 * update({ title: 'Updated Title' });
 * ```
 */
function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          dismiss();
        }
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

/**
 * React hook for managing toast notifications in components.
 * Provides access to toast state and functions for creating and dismissing toasts.
 * 
 * @returns {object} Toast state and control functions.
 * @returns {ToasterToast[]} Returns.toasts - Array of current active toasts.
 * @returns {Function} Returns.toast - Function to create new toast notifications.
 * @returns {Function} Returns.dismiss - Function to dismiss specific or all toasts.
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { toast, dismiss, toasts } = useToast();
 * 
 *   const showSuccess = () => {
 *     toast({
 *       title: 'Success!',
 *       description: 'Your changes have been saved.'
 *     });
 *   };
 * 
 *   return (
 *     <button onClick={showSuccess}>Save Changes</button>
 *   );
 * }
 * ```
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

export { useToast, toast };
