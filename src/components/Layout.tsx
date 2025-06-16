
import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import TrialStatusBanner from '@/components/TrialStatusBanner';

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
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
          </header>
          <TrialStatusBanner />
          <main className="p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Layout;
