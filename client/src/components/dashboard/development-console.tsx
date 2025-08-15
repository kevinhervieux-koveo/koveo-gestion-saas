import { Card, CardContent } from '@/components/ui/card';
import { Terminal } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useEffect, useState } from 'react';

/**
 *
 */
export function DevelopmentConsole() {
  const { t } = useLanguage();
  const [currentLine, setCurrentLine] = useState(0);

  const consoleLines = [
    { text: '$ koveo-init --workspace=koveo-gestion-rebuilt', color: 'text-green-400' },
    { text: '✓ Initializing Next.js workspace...', color: 'text-gray-300' },
    { text: '✓ Installing TypeScript dependencies...', color: 'text-gray-300' },
    { text: '✓ Configuring development environment...', color: 'text-gray-300' },
    { text: '→ Ready to initialize QA Pillar', color: 'text-yellow-400' },
    { text: 'koveo-dev$ █', color: 'text-blue-400 animate-pulse' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLine((prev) => (prev < consoleLines.length - 1 ? prev + 1 : prev));
    }, 1000);

    return () => clearInterval(timer);
  }, [consoleLines.length]);

  return (
    <Card className='bg-gray-900 text-white border-gray-700'>
      <CardContent className='p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold flex items-center'>
            <Terminal className='mr-3' size={20} />
            {t('developmentConsole')}
          </h3>
          <div className='flex space-x-2'>
            <div className='w-3 h-3 bg-red-500 rounded-full'></div>
            <div className='w-3 h-3 bg-yellow-500 rounded-full'></div>
            <div className='w-3 h-3 bg-green-500 rounded-full'></div>
          </div>
        </div>
        <div className='font-mono text-sm space-y-2'>
          {consoleLines.slice(0, currentLine + 1).map((line, index) => (
            <div key={`console-line-${index}-${line.text}`} className={line.color}>
              {line.text}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
