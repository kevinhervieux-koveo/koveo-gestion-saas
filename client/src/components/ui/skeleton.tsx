import { cn } from '@/lib/utils';

/**

 * Skeleton function

 * @returns Function result

 */

function  /**
   * Skeleton function.
   * @param { className - { className parameter.
   * @param ...props } - ...props } parameter.
   */
 Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
