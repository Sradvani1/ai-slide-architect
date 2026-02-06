/**
 * Central icon exports. All icons are from @heroicons/react/24/outline
 * for consistent look and a single dependency.
 */
import { CheckIcon as HeroCheckIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

// Re-export with existing names so consumers don't change
export { DocumentDuplicateIcon as CopyIcon } from '@heroicons/react/24/outline';
export { ArrowDownTrayIcon as DownloadIcon } from '@heroicons/react/24/outline';
export { PhotoIcon as ImageIcon } from '@heroicons/react/24/outline';
export { DocumentIcon as PptxIcon } from '@heroicons/react/24/outline';
export { DocumentTextIcon, ShareIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
export { SparklesIcon as GenerateIcon } from '@heroicons/react/24/outline';
export { PencilIcon } from '@heroicons/react/24/outline';

// CheckIcon: keep green color for success state (matches previous custom icon)
export function CheckIcon({ className, ...props }: React.ComponentProps<typeof HeroCheckIcon>) {
    return <HeroCheckIcon className={clsx('text-green-400', className)} {...props} />;
}
