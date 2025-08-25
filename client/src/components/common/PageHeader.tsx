import { ReactNode } from 'react';

/**
 *
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
}

/**
 * Common page header component for consistent title/description layout.
 * @param root0
 * @param root0.title
 * @param root0.description
 * @param root0.actions
 * @param root0.titleClassName
 * @param root0.descriptionClassName
 */
export function PageHeader({
  title,
  description,
  actions,
  titleClassName = 'text-3xl font-bold',
  descriptionClassName = 'text-muted-foreground',
}: PageHeaderProps) {
  return (
    <div className='flex items-center justify-between'>
      <div>
        <h1 className={titleClassName}>{title}</h1>
        {description && <p className={descriptionClassName}>{description}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
