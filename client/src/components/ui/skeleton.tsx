import { cn } from '@/lib/utils';

/**

 * Skeleton function

 * @returns Function result

 */

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
