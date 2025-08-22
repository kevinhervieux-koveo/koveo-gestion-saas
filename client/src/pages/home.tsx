import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HamburgerMenu } from '@/components/ui/hamburger-menu';
import { TrialRequestForm } from '@/components/ui/trial-request-form';
import { Building, Users, Shield, BarChart3, ArrowRight, CheckCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Home page component for Koveo Gestion.
 * Public-facing landing page with company information and call-to-action.
 */
export default function  /**
   * Home page function.
   */
 HomePage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Navigation Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src={koveoLogo} 
              alt="Koveo Gestion" 
              className="h-10 w-10 rounded-lg object-cover cursor-pointer"
              onClick={() => setLocation('/')}
              data-testid="logo-link"
            />
          </div>
          <HamburgerMenu />
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            {t('modernPropertyManagement')}
            <span className="text-blue-600"> {t('forQuebec')}</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            {t('comprehensivePropertyManagement')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <TrialRequestForm>
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
                data-testid="button-start-trial"
              >
                {t('startManagingToday')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </TrialRequestForm>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t('everythingYouNeed')}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('builtForPropertyOwners')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Building className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>{t('buildingManagement')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t('buildingManagementDesc')}
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>{t('residentPortal')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t('residentPortalDesc')}
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>{t('financialReporting')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t('financialReportingDesc')}
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Shield className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <CardTitle>{t('quebecCompliance')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t('quebecComplianceDesc')}
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              {t('whyChooseKoveo')}
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{t('quebecLaw25Compliant')}</h3>
                    <p className="text-gray-600">
                      {t('quebecLaw25CompliantDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{t('bilingualSupport')}</h3>
                    <p className="text-gray-600">
                      {t('bilingualSupportDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{t('roleBasedAccess')}</h3>
                    <p className="text-gray-600">
                      {t('roleBasedAccessDesc')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{t('cloudBasedSecurity')}</h3>
                    <p className="text-gray-600">
                      {t('cloudBasedSecurityDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{t('mobileResponsive')}</h3>
                    <p className="text-gray-600">
                      {t('mobileResponsiveDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{t('expertSupport')}</h3>
                    <p className="text-gray-600">
                      {t('expertSupportDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t('readyToTransform')}
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            {t('joinPropertyOwners')}
          </p>
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
            onClick={() => setLocation('/login')}
          >
            {t('getStartedNow')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <img 
                src={koveoLogo} 
                alt="Koveo Gestion" 
                className="h-8 w-8 rounded object-cover"
              />
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <Shield className="h-4 w-4" />
              <span>{t('quebecLaw25Compliant')}</span>
              <span>•</span>
              <span>{t('yourDataIsProtected')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}