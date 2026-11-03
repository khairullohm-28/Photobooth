import React, { useState, useEffect, useCallback } from 'react';
import { AdminProfile, AppSettings } from '../types/admin';
import { AdminService, DEFAULT_APP_SETTINGS } from '../services/adminService';
import { ToastProvider } from './components/Toast';
import { AdminLayout } from './components/AdminLayout';
import { Loader2 } from 'lucide-react';

// Lazy-load all admin pages to isolate heavy dependencies (konva, recharts, xlsx, jszip)
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const FirstSetupPage = React.lazy(() => import('./pages/FirstSetupPage').then(m => ({ default: m.FirstSetupPage })));
const WebsiteAdminPage = React.lazy(() => import('./pages/WebsiteAdminPage').then(m => ({ default: m.WebsiteAdminPage })));
const TeamManagementPage = React.lazy(() => import('./pages/TeamManagementPage').then(m => ({ default: m.TeamManagementPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const BookingResultsPage = React.lazy(() => import('./pages/BookingResultsPage').then(m => ({ default: m.BookingResultsPage })));
const TemplateCategoriesPage = React.lazy(() => import('./pages/TemplateCategoriesPage').then(m => ({ default: m.TemplateCategoriesPage })));
const TemplatesListPage = React.lazy(() => import('./pages/TemplatesListPage').then(m => ({ default: m.TemplatesListPage })));
const FrameEditorPage = React.lazy(() => import('./pages/FrameEditorPage').then(m => ({ default: m.FrameEditorPage })));
const FilterManagementPage = React.lazy(() => import('./pages/FilterManagementPage').then(m => ({ default: m.FilterManagementPage })));
const UserEventsPage = React.lazy(() => import('./pages/UserEventsPage').then(m => ({ default: m.UserEventsPage })));
const PrintHistoryPage = React.lazy(() => import('./pages/PrintHistoryPage').then(m => ({ default: m.PrintHistoryPage })));
const PrinterSettingsPage = React.lazy(() => import('./pages/PrinterSettingsPage').then(m => ({ default: m.PrinterSettingsPage })));
const EventSummaryReportPage = React.lazy(() => import('./pages/reports/EventSummaryReportPage').then(m => ({ default: m.EventSummaryReportPage })));
const PeriodicUsageReportPage = React.lazy(() => import('./pages/reports/PeriodicUsageReportPage').then(m => ({ default: m.PeriodicUsageReportPage })));
const TemplatesFiltersReportPage = React.lazy(() => import('./pages/reports/TemplatesFiltersReportPage').then(m => ({ default: m.TemplatesFiltersReportPage })));
const PrintsReportPage = React.lazy(() => import('./pages/reports/PrintsReportPage').then(m => ({ default: m.PrintsReportPage })));
const StorageReportPage = React.lazy(() => import('./pages/reports/StorageReportPage').then(m => ({ default: m.StorageReportPage })));
const AuditLogReportPage = React.lazy(() => import('./pages/reports/AuditLogReportPage').then(m => ({ default: m.AuditLogReportPage })));
const PlaceholderPage = React.lazy(() => import('./pages/PlaceholderPage').then(m => ({ default: m.PlaceholderPage })));

const PageLoader = () => (
  <div className="w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-stone-500">
    <Loader2 className="w-8 h-8 text-stone-800 animate-spin mb-2" />
    <span className="font-serif text-xs text-stone-600">Memuat Halaman...</span>
  </div>
);

export const AdminApp: React.FC = () => {
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(() =>
    AdminService.getCurrentAdmin()
  );
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [hasOwner, setHasOwner] = useState<boolean>(true);
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync route
  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  }, []);

  // Popstate listener
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initial data load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [settings, ownerExists] = await Promise.all([
          AdminService.getSettings(),
          AdminService.checkHasAnyOwner(),
        ]);
        setAppSettings(settings);
        setHasOwner(ownerExists);

        // Auto-seed demo sessions and analytics if fresh installation
        try {
          const rawSess = localStorage.getItem('wedding_pb_sessions');
          if (!rawSess) {
            const { DemoDataService } = await import('../services/demoDataService');
            await DemoDataService.generateDemoData();
          }
        } catch {}

        // Check if user is logged in
        const user = AdminService.getCurrentAdmin();
        setCurrentAdmin(user);

        // Routing redirects
        const path = window.location.pathname;
        if (!user && path !== '/admin/setup') {
          if (!ownerExists) {
            navigate('/admin/setup');
          } else if (path !== '/admin/login') {
            navigate('/admin/login');
          }
        } else if (user && (path === '/admin' || path === '/admin/login')) {
          navigate('/admin/dashboard');
        }
      } catch (err) {
        console.error('Failed to init admin:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [navigate]);

  const handleLoginSuccess = (user: AdminProfile) => {
    setCurrentAdmin(user);
    navigate('/admin/dashboard');
  };

  const handleLogout = async () => {
    await AdminService.logout();
    setCurrentAdmin(null);
    navigate('/admin/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-stone-900 animate-spin mb-2" />
        <span className="font-serif text-xs text-stone-600">
          Memuat Portal Admin...
        </span>
      </div>
    );
  }

  // First Setup Page
  if (currentPath === '/admin/setup') {
    return (
      <ToastProvider>
        <React.Suspense fallback={<PageLoader />}>
          <FirstSetupPage
            onSetupSuccess={(owner) => {
              setCurrentAdmin(owner);
              setHasOwner(true);
              navigate('/admin/dashboard');
            }}
            onBackToLogin={() => navigate('/admin/login')}
          />
        </React.Suspense>
      </ToastProvider>
    );
  }

  // Login Page
  if (!currentAdmin || currentPath === '/admin/login') {
    return (
      <ToastProvider>
        <React.Suspense fallback={<PageLoader />}>
          <LoginPage
            appSettings={appSettings}
            hasOwner={hasOwner}
            onLoginSuccess={handleLoginSuccess}
            onGoToSetup={() => navigate('/admin/setup')}
          />
        </React.Suspense>
      </ToastProvider>
    );
  }

  // Determine active view & breadcrumbs
  let pageContent: React.ReactNode = null;
  let breadcrumb: { label: string; path?: string }[] = [{ label: 'Dashboard', path: '/admin/dashboard' }];

  const normPath = currentPath.replace(/^\/admin\/setting\b/, '/admin/settings');

  if (normPath === '/admin/dashboard' || normPath === '/admin') {
    breadcrumb = [{ label: 'Dashboard' }];
    pageContent = (
      <DashboardPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
        onNavigate={navigate}
      />
    );
  }
  // Booking routes
  else if (normPath === '/admin/booking/results' || normPath === '/admin/booking') {
    breadcrumb = [
      { label: 'Booking', path: '/admin/booking/results' },
      { label: 'Hasil per User' },
    ];
    pageContent = <BookingResultsPage currentAdmin={currentAdmin} />;
  } else if (
    normPath === '/admin/booking/print-history' ||
    normPath === '/admin/booking/riwayat'
  ) {
    breadcrumb = [
      { label: 'Booking', path: '/admin/booking/results' },
      { label: 'Riwayat Cetak' },
    ];
    pageContent = <PrintHistoryPage />;
  }
  // Studio Foto routes
  else if (
    normPath === '/admin/studio/categories' ||
    normPath === '/admin/studio-foto/kategori' ||
    normPath === '/admin/studio'
  ) {
    breadcrumb = [
      { label: 'Studio Foto', path: '/admin/studio/categories' },
      { label: 'Kategori Template' },
    ];
    pageContent = <TemplateCategoriesPage />;
  } else if (
    normPath === '/admin/studio/templates/new' ||
    normPath === '/admin/studio-foto/template/new'
  ) {
    breadcrumb = [
      { label: 'Studio Foto', path: '/admin/studio/categories' },
      { label: 'Template', path: '/admin/studio/templates' },
      { label: 'Tambah Template' },
    ];
    pageContent = <FrameEditorPage onNavigate={navigate} />;
  } else if (
    normPath.startsWith('/admin/studio/templates/edit/') ||
    normPath.startsWith('/admin/studio-foto/template/edit/')
  ) {
    const editId = normPath.split('/edit/')[1];
    breadcrumb = [
      { label: 'Studio Foto', path: '/admin/studio/categories' },
      { label: 'Template', path: '/admin/studio/templates' },
      { label: 'Edit Template' },
    ];
    pageContent = <FrameEditorPage templateId={editId} onNavigate={navigate} />;
  } else if (
    normPath === '/admin/studio/templates' ||
    normPath === '/admin/studio-foto/template'
  ) {
    breadcrumb = [
      { label: 'Studio Foto', path: '/admin/studio/categories' },
      { label: 'Template' },
    ];
    pageContent = <TemplatesListPage onNavigate={navigate} />;
  } else if (
    normPath === '/admin/studio/filters' ||
    normPath === '/admin/studio-foto/filter'
  ) {
    breadcrumb = [
      { label: 'Studio Foto', path: '/admin/studio/categories' },
      { label: 'Filter' },
    ];
    pageContent = <FilterManagementPage />;
  }
  // User (Acara) route
  else if (normPath === '/admin/events' || normPath === '/admin/user') {
    breadcrumb = [{ label: 'User' }];
    pageContent = (
      <UserEventsPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
        onNavigate={navigate}
      />
    );
  }
  // Settings routes (handles both /admin/setting/ and /admin/settings/)
  else if (normPath === '/admin/settings/team' || normPath === '/admin/settings') {
    breadcrumb = [
      { label: 'Setting', path: '/admin/settings/team' },
      { label: 'Team' },
    ];
    pageContent = <TeamManagementPage currentAdmin={currentAdmin} />;
  } else if (normPath === '/admin/settings/website') {
    breadcrumb = [
      { label: 'Setting', path: '/admin/settings/team' },
      { label: 'Website Admin' },
    ];
    pageContent = (
      <WebsiteAdminPage
        initialSettings={appSettings}
        onSettingsUpdated={(updated) => setAppSettings(updated)}
      />
    );
  } else if (normPath === '/admin/settings/printer' || normPath === '/admin/setting/printer') {
    breadcrumb = [
      { label: 'Setting', path: '/admin/settings/team' },
      { label: 'Printer' },
    ];
    pageContent = <PrinterSettingsPage />;
  }
  // Reports routes
  else if (
    normPath === '/admin/reports/events' ||
    normPath === '/admin/reports' ||
    normPath === '/admin/laporan'
  ) {
    breadcrumb = [
      { label: 'Laporan', path: '/admin/reports/events' },
      { label: 'Rekap Per Acara' },
    ];
    pageContent = (
      <EventSummaryReportPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
      />
    );
  } else if (
    normPath === '/admin/reports/periodic' ||
    normPath === '/admin/reports/usage'
  ) {
    breadcrumb = [
      { label: 'Laporan', path: '/admin/reports/events' },
      { label: 'Penggunaan Periodik' },
    ];
    pageContent = (
      <PeriodicUsageReportPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
      />
    );
  } else if (normPath === '/admin/reports/templates-filters') {
    breadcrumb = [
      { label: 'Laporan', path: '/admin/reports/events' },
      { label: 'Template & Filter' },
    ];
    pageContent = (
      <TemplatesFiltersReportPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
      />
    );
  } else if (normPath === '/admin/reports/prints') {
    breadcrumb = [
      { label: 'Laporan', path: '/admin/reports/events' },
      { label: 'Cetak' },
    ];
    pageContent = (
      <PrintsReportPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
      />
    );
  } else if (normPath === '/admin/reports/storage') {
    breadcrumb = [
      { label: 'Laporan', path: '/admin/reports/events' },
      { label: 'Penyimpanan & Retensi' },
    ];
    pageContent = (
      <StorageReportPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
      />
    );
  } else if (
    normPath === '/admin/reports/audit-log' ||
    normPath === '/admin/reports/logs'
  ) {
    breadcrumb = [
      { label: 'Laporan', path: '/admin/reports/events' },
      { label: 'Aktivitas Tim' },
    ];
    pageContent = (
      <AuditLogReportPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
      />
    );
  } else {
    // Default fallback to dashboard
    breadcrumb = [{ label: 'Dashboard' }];
    pageContent = (
      <DashboardPage
        currentAdmin={currentAdmin}
        appSettings={appSettings}
        onNavigate={navigate}
      />
    );
  }

  return (
    <ToastProvider>
      <AdminLayout
        currentAdmin={currentAdmin}
        appSettings={appSettings}
        activePath={currentPath}
        onNavigate={navigate}
        onLogout={handleLogout}
        breadcrumb={breadcrumb}
      >
        <React.Suspense fallback={<PageLoader />}>
          {pageContent}
        </React.Suspense>
      </AdminLayout>
    </ToastProvider>
  );
};
