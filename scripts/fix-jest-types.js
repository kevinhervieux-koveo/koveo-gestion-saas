#!/usr/bin/env node

/**
 * Fix Jest DOM type declarations for deployment
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

console.log('🔧 Fixing Jest DOM type declarations...');

// Ensure types directory exists
const typesDir = path.join(process.cwd(), 'types');
if (!existsSync(typesDir)) {
  mkdirSync(typesDir, { recursive: true });
}

// Create comprehensive Jest DOM type declarations
const jestDomTypes = `
// Jest DOM type declarations
/// <reference types="jest" />

declare namespace jest {
  interface Matchers<R = void> {
    toBeInTheDocument(): R;
    toHaveTextContent(text: string | RegExp): R;
    toBeVisible(): R;
    toBeEnabled(): R;
    toBeDisabled(): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveClass(className: string): R;
    toHaveStyle(css: string | object): R;
    toBeChecked(): R;
    toBePartiallyChecked(): R;
    toHaveValue(value: string | string[] | number): R;
    toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
    toBeRequired(): R;
    toBeInvalid(): R;
    toBeValid(): R;
    toHaveFocus(): R;
    toHaveFormValues(expectedValues: Record<string, any>): R;
    toHaveErrorMessage(text: string | RegExp): R;
    toHaveDescription(text: string | RegExp): R;
  }
}

// Augment expect
interface JestDOMMatchers<T> {
  toBeInTheDocument(): T;
  toHaveTextContent(text: string | RegExp): T;
  toBeVisible(): T;
  toBeEnabled(): T;
  toBeDisabled(): T;
  toHaveAttribute(attr: string, value?: string): T;
  toHaveClass(className: string): T;
  toHaveStyle(css: string | object): T;
  toBeChecked(): T;
  toBePartiallyChecked(): T;
  toHaveValue(value: string | string[] | number): T;
  toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): T;
  toBeRequired(): T;
  toBeInvalid(): T;
  toBeValid(): T;
  toHaveFocus(): T;
  toHaveFormValues(expectedValues: Record<string, any>): T;
  toHaveErrorMessage(text: string | RegExp): T;
  toHaveDescription(text: string | RegExp): T;
}

declare global {
  namespace jest {
    interface Expect {
      <T = any>(actual: T): JestDOMMatchers<T> & jest.Matchers<void, T>;
    }
  }
}

export {};
`;

writeFileSync(path.join(typesDir, 'jest-dom-extended.d.ts'), jestDomTypes);
console.log('✅ Created extended Jest DOM type declarations');

// Create module declaration for testing-library/jest-dom
const testingLibraryTypes = `
declare module '@testing-library/jest-dom' {
  import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
  
  global {
    namespace jest {
      interface Matchers<R = void> extends TestingLibraryMatchers<typeof expect.stringContaining, R> {}
    }
  }
}

declare module '@testing-library/jest-dom/matchers' {
  export interface TestingLibraryMatchers<T, R> {
    toBeInTheDocument(): R;
    toHaveTextContent(text: string | RegExp): R;
    toBeVisible(): R;
    toBeEnabled(): R;
    toBeDisabled(): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveClass(className: string): R;
    toHaveStyle(css: string | object): R;
    toBeChecked(): R;
    toBePartiallyChecked(): R;
    toHaveValue(value: string | string[] | number): R;
    toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
    toBeRequired(): R;
    toBeInvalid(): R;
    toBeValid(): R;
    toHaveFocus(): R;
    toHaveFormValues(expectedValues: Record<string, any>): R;
    toHaveErrorMessage(text: string | RegExp): R;
    toHaveDescription(text: string | RegExp): R;
  }
}
`;

writeFileSync(path.join(typesDir, 'testing-library.d.ts'), testingLibraryTypes);
console.log('✅ Created testing-library type declarations');

console.log('🎉 Jest DOM type fixes completed!');