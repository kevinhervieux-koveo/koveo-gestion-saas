import { Header } from '@/components/layout/header';
import { InitializationWizard } from '@/components/dashboard/initialization-wizard';
import { PillarFramework } from '@/components/dashboard/pillar-framework';
import { WorkspaceStatus } from '@/components/dashboard/workspace-status';
import { QualityMetrics } from '@/components/dashboard/quality-metrics';
import { DevelopmentConsole } from '@/components/dashboard/development-console';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layers, Database, Shield, Play, Lock, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

export default function Dashboard() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('developmentFrameworkInitialization')}
        subtitle={t('settingUpPillarMethodology')}
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <InitializationWizard />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Setup Configuration */}
            <div className="space-y-6">
              {/* Framework Selection */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Layers className="text-koveo-navy mr-3" size={20} />
                    {t('frameworkConfiguration')}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-blue-500 text-xl">⚛</div>
                          <div>
                            <p className="font-medium text-gray-900">Next.js + TypeScript</p>
                            <p className="text-sm text-gray-600">{t('recommended')}</p>
                          </div>
                        </div>
                        <div className="flex items-center text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-sm font-medium">{t('selected')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 border border-gray-200 rounded-lg">
                        <Database className="text-blue-500 mb-2" size={16} />
                        <p className="font-medium text-sm">{t('database')}</p>
                        <p className="text-xs text-gray-600">PostgreSQL</p>
                      </div>
                      <div className="p-3 border border-gray-200 rounded-lg">
                        <Shield className="text-green-500 mb-2" size={16} />
                        <p className="font-medium text-sm">{t('auth')}</p>
                        <p className="text-xs text-gray-600">NextAuth.js</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <PillarFramework />
            </div>

            {/* Right Column: Current Status & Actions */}
            <div className="space-y-6">
              <WorkspaceStatus />
              <QualityMetrics />

              {/* Next Actions */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <div className="text-koveo-navy mr-3">📋</div>
                    {t('nextActions')}
                  </h3>
                  
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-between border-koveo-navy bg-koveo-navy bg-opacity-5 hover:bg-opacity-10 text-left h-auto p-3"
                    >
                      <div className="flex items-center space-x-3">
                        <Play className="text-koveo-navy" size={16} />
                        <div className="text-left">
                          <div className="font-medium text-gray-900">{t('initializeQAPillar')}</div>
                          <p className="text-sm text-gray-600 mt-1">{t('setupValidationQualityAssurance')}</p>
                        </div>
                      </div>
                      <ArrowRight className="text-koveo-navy" size={16} />
                    </Button>

                    <Button
                      variant="outline"
                      disabled
                      className="w-full justify-between opacity-50 cursor-not-allowed text-left h-auto p-3"
                    >
                      <div className="flex items-center space-x-3">
                        <Lock className="text-gray-400" size={16} />
                        <div className="text-left">
                          <div className="font-medium text-gray-500">{t('configureTesting')}</div>
                          <p className="text-sm text-gray-400 mt-1">{t('availableAfterQACompletion')}</p>
                        </div>
                      </div>
                      <Lock className="text-gray-400" size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Command Line Interface Preview */}
          <div className="mt-8">
            <DevelopmentConsole />
          </div>
        </div>
      </div>
    </div>
  );
}
