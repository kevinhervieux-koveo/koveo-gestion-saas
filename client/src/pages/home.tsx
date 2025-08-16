import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Users, Shield, BarChart3, ArrowRight, CheckCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Home page component for Koveo Gestion.
 * Public-facing landing page with company information and call-to-action.
 */
export default function HomePage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Navigation Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src={koveoLogo} 
              alt="Koveo Gestion" 
              className="h-10 w-10 rounded-lg object-cover"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Koveo Gestion</h1>
            </div>
          </div>
          <div className="flex space-x-3">
            {isAuthenticated ? (
              <Button onClick={() => setLocation('/dashboard')} className="bg-blue-600 hover:bg-blue-700">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setLocation('/login')}>
                  Sign In
                </Button>
                <Button onClick={() => setLocation('/login')} className="bg-blue-600 hover:bg-blue-700">
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Modern Property Management
            <span className="text-blue-600"> for Quebec</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Comprehensive property management solution designed specifically for Quebec's 
            regulatory environment. Manage buildings, residents, finances, and compliance 
            all in one secure platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
              onClick={() => setLocation('/login')}
            >
              Start Managing Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-3"
              onClick={() => setLocation('/accept-invitation')}
            >
              I Have an Invitation
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Everything You Need to Manage Properties
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Built for property owners, managers, and residents with Quebec-specific 
            compliance and bilingual support.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Building className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Building Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Comprehensive building oversight with maintenance tracking, 
                resident management, and compliance monitoring.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Resident Portal</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Self-service portal for residents to view bills, submit requests, 
                and communicate with property management.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Financial Reporting</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Detailed financial analytics, budget tracking, and 
                Quebec-compliant reporting for transparency.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Shield className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <CardTitle>Quebec Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Built-in compliance with Quebec Law 25 and property 
                management regulations. Data protection guaranteed.
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
              Why Choose Koveo Gestion?
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Quebec Law 25 Compliant</h3>
                    <p className="text-gray-600">
                      Full compliance with Quebec's privacy and data protection regulations.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Bilingual Support</h3>
                    <p className="text-gray-600">
                      Full French and English language support for all users.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Role-Based Access</h3>
                    <p className="text-gray-600">
                      Secure access controls for owners, managers, and residents.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Cloud-Based Security</h3>
                    <p className="text-gray-600">
                      Enterprise-grade security with automatic backups and updates.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Mobile Responsive</h3>
                    <p className="text-gray-600">
                      Access your property management tools from any device, anywhere.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Expert Support</h3>
                    <p className="text-gray-600">
                      Dedicated support team with Quebec property management expertise.
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
            Ready to Transform Your Property Management?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join property owners and managers across Quebec who trust Koveo Gestion 
            for their property management needs.
          </p>
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
            onClick={() => setLocation('/login')}
          >
            Get Started Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img 
                src={koveoLogo} 
                alt="Koveo Gestion" 
                className="h-8 w-8 rounded object-cover"
              />
              <div>
                <h3 className="font-semibold">Koveo Gestion</h3>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <Shield className="h-4 w-4" />
              <span>Quebec Law 25 Compliant</span>
              <span>•</span>
              <span>Your data is protected</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}