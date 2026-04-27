/**
 * Augment @types/multer with the `defParamCharset` option present in
 * multer 2.x but not yet declared in the published typings.
 * Remove this file once @types/multer ships the declaration.
 */
import 'multer';

declare module 'multer' {
  interface Options {
    defParamCharset?: string;
  }
}
