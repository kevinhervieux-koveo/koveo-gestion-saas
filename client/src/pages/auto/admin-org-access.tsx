/**
 * Admin – Org Access page (Task #1473 / Task #657).
 *
 * Auto-registered via the `client/src/pages/auto/_register.tsx` system.
 */

import type { AutoPageRoute } from './_register';
import { Header } from '@/components/layout/header';
import { HardHat } from 'lucide-react';

export const route: AutoPageRoute = {
  path: '/admin/org-access',
  role: 'admin',
};

export default function AdminOrgAccessPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Org Access" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <div className="rounded-full bg-muted p-5">
            <HardHat className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Page under construction</h2>
          <p className="text-muted-foreground max-w-sm">
            This page is currently unavailable. Check back later.
          </p>
        </div>
      </div>
    </div>
  );
}
