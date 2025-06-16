
import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import TrialStatusBanner from '@/components/TrialStatusBanner';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50 w-full" dir="rtl">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-4">
            {/* Mobile hamburger menu */}
            <SidebarTrigger className="md:hidden">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            
            {/* Desktop sidebar trigger - always visible */}
            <SidebarTrigger className="hidden md:block" />
            
            <div className="flex-1" />
          </header>
          {/* Remove top margin from TrialStatusBanner */}
          <div className="bg-white">
            <TrialStatusBanner />
          </div>
          <main className="p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Layout;
