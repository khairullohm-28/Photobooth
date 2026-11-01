import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Camera,
  Users,
  Settings,
  FileText,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { AdminProfile, AppSettings } from '../../types/admin';

export interface SubMenuItemDef {
  id: string;
  label: string;
  path: string;
  permissionKey: string;
}

export interface MenuItemDef {
  id: string;
  label: string;
  icon: React.ElementType;
  path?: string;
  permissionKey: string;
  subItems?: SubMenuItemDef[];
}

export const MENU_ITEMS: MenuItemDef[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin/dashboard',
    permissionKey: 'dashboard',
  },
  {
    id: 'booking',
    label: 'Booking',
    icon: CalendarDays,
    permissionKey: 'booking',
    subItems: [
      {
        id: 'booking.results',
        label: 'Hasil per User',
        path: '/admin/booking/results',
        permissionKey: 'booking.results',
      },
      {
        id: 'booking.print_history',
        label: 'Riwayat Cetak',
        path: '/admin/booking/print-history',
        permissionKey: 'booking.print_history',
      },
    ],
  },
  {
    id: 'studio',
    label: 'Studio Foto',
    icon: Camera,
    permissionKey: 'studio',
    subItems: [
      {
        id: 'studio.categories',
        label: 'Kategori Template',
        path: '/admin/studio/categories',
        permissionKey: 'studio.categories',
      },
      {
        id: 'studio.templates',
        label: 'Template',
        path: '/admin/studio/templates',
        permissionKey: 'studio.templates',
      },
      {
        id: 'studio.filters',
        label: 'Filter',
        path: '/admin/studio/filters',
        permissionKey: 'studio.filters',
      },
    ],
  },
  {
    id: 'events',
    label: 'User',
    icon: Users,
    path: '/admin/events',
    permissionKey: 'events',
  },
  {
    id: 'settings',
    label: 'Setting',
    icon: Settings,
    permissionKey: 'settings',
    subItems: [
      {
        id: 'settings.team',
        label: 'Team',
        path: '/admin/settings/team',
        permissionKey: 'settings.team',
      },
      {
        id: 'settings.website',
        label: 'Website Admin',
        path: '/admin/settings/website',
        permissionKey: 'settings.website',
      },
      {
        id: 'settings.printer',
        label: 'Printer',
        path: '/admin/settings/printer',
        permissionKey: 'settings.printer',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Laporan',
    icon: FileText,
    permissionKey: 'reports',
    subItems: [
      {
        id: 'reports.events',
        label: 'Rekap Per Acara',
        path: '/admin/reports/events',
        permissionKey: 'reports.events',
      },
      {
        id: 'reports.periodic',
        label: 'Penggunaan Periodik',
        path: '/admin/reports/periodic',
        permissionKey: 'reports.periodic',
      },
      {
        id: 'reports.templates_filters',
        label: 'Template & Filter',
        path: '/admin/reports/templates-filters',
        permissionKey: 'reports.templates_filters',
      },
      {
        id: 'reports.prints',
        label: 'Cetak',
        path: '/admin/reports/prints',
        permissionKey: 'reports.prints',
      },
      {
        id: 'reports.storage',
        label: 'Penyimpanan & Retensi',
        path: '/admin/reports/storage',
        permissionKey: 'reports.storage',
      },
      {
        id: 'reports.audit_log',
        label: 'Aktivitas Tim',
        path: '/admin/reports/audit-log',
        permissionKey: 'reports.audit_log',
      },
    ],
  },
];

export const normalizePath = (p: string): string => {
  return p
    .replace(/^\/admin\/setting\b/, '/admin/settings')
    .replace(/^\/admin\/studio-foto\/kategori\b/, '/admin/studio/categories')
    .replace(/^\/admin\/studio-foto\/template\b/, '/admin/studio/templates')
    .replace(/^\/admin\/studio-foto\b/, '/admin/studio');
};

export const isPathMatching = (itemPath?: string, activePath?: string): boolean => {
  if (!itemPath || !activePath) return false;
  if (itemPath === activePath) return true;
  return normalizePath(itemPath) === normalizePath(activePath);
};

export const getActiveGroupId = (activePath: string): string | null => {
  const norm = normalizePath(activePath);
  for (const item of MENU_ITEMS) {
    if (item.subItems && item.subItems.length > 0) {
      if (item.subItems.some((sub) => isPathMatching(sub.path, norm))) {
        return item.id;
      }
      if (
        (item.id === 'booking' && norm.startsWith('/admin/booking')) ||
        (item.id === 'studio' && (norm.startsWith('/admin/studio') || norm.startsWith('/admin/studio-foto'))) ||
        (item.id === 'settings' && norm.startsWith('/admin/settings')) ||
        (item.id === 'reports' && (norm.startsWith('/admin/reports') || norm.startsWith('/admin/laporan')))
      ) {
        return item.id;
      }
    }
  }
  return null;
};

interface AdminLayoutProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
  activePath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  breadcrumb?: { label: string; path?: string }[];
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentAdmin,
  appSettings,
  activePath,
  onNavigate,
  onLogout,
  children,
  breadcrumb = [],
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(() => getActiveGroupId(activePath));

  // Sync open accordion group whenever activePath changes or on refresh
  useEffect(() => {
    const matchedGroup = getActiveGroupId(activePath);
    if (matchedGroup) {
      setOpenGroupId(matchedGroup);
    }
  }, [activePath]);

  // Check if current user has permission for a specific key
  const hasPermission = (key: string): boolean => {
    if (currentAdmin.role === 'owner') return true;
    if (currentAdmin.permissions.includes('*')) return true;
    if (currentAdmin.permissions.includes(key)) return true;
    const parentKey = key.split('.')[0];
    return currentAdmin.permissions.includes(parentKey);
  };

  const handleNavClick = (path: string) => {
    onNavigate(path);
    setMobileDrawerOpen(false);
  };

  const handleParentMenuClick = (item: MenuItemDef) => {
    if (item.subItems && item.subItems.length > 0) {
      // 1. Accordion behavior: only ONE group is open at any time
      setOpenGroupId(item.id);
      // 2. Click parent opens the group AND immediately opens its first submenu
      const firstSubPath = item.subItems[0].path;
      handleNavClick(firstSubPath);
    } else if (item.path) {
      // Top-level single item without submenu (e.g. Dashboard, User)
      setOpenGroupId(null);
      handleNavClick(item.path);
    }
  };

  const toggleAccordionOnly = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    // Only one group open at a time; clicking toggles it closed or opens it
    setOpenGroupId((prev) => (prev === groupId ? null : groupId));
  };

  const sidebarBg = appSettings.ui_colors?.sidebar_bg || '#EBEBEB';
  const textColor = appSettings.ui_colors?.text || '#121212';
  const accentColor = appSettings.ui_colors?.accent || '#d4af37';

  // Navigation Items list component (shared between desktop aside and mobile drawer)
  const renderMenuItems = () => {
    return (
      <div className="space-y-1">
        {MENU_ITEMS.map((item) => {
          if (!hasPermission(item.permissionKey)) return null;

          const Icon = item.icon;
          const hasSub = item.subItems && item.subItems.length > 0;
          const isOpen = openGroupId === item.id;
          const isDirectActive = item.path && isPathMatching(item.path, activePath);
          const isChildActive =
            hasSub && item.subItems?.some((sub) => isPathMatching(sub.path, activePath));

          return (
            <div key={item.id} className="space-y-0.5" data-testid={`menu-group-${item.id}`}>
              {hasSub ? (
                <div
                  onClick={() => handleParentMenuClick(item)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-serif tracking-wider transition-all cursor-pointer ${
                    isChildActive || isOpen
                      ? 'bg-stone-900 text-white font-bold shadow-sm'
                      : 'text-stone-800 hover:bg-stone-300/60 font-medium'
                  }`}
                  data-testid={`menu-parent-${item.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 stroke-[1.8]" />
                    <span>{item.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleAccordionOnly(e, item.id)}
                    className="p-1 -mr-1 rounded hover:bg-white/10 active:scale-95 transition-all"
                    aria-label={`Toggle ${item.label}`}
                  >
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleParentMenuClick(item)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-serif tracking-wider transition-all cursor-pointer ${
                    isDirectActive
                      ? 'bg-stone-900 text-white font-bold shadow-sm'
                      : 'text-stone-800 hover:bg-stone-300/60 font-medium'
                  }`}
                  data-testid={`menu-item-${item.id}`}
                >
                  <Icon className="w-4 h-4 stroke-[1.8]" />
                  <span>{item.label}</span>
                </button>
              )}

              {/* Accordion Submenu: ONLY rendered when this group is the open group */}
              {hasSub && isOpen && (
                <div
                  className="pl-9 pr-1 py-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150"
                  data-testid={`submenu-container-${item.id}`}
                >
                  {item.subItems?.map((sub) => {
                    if (!hasPermission(sub.permissionKey)) return null;
                    const isSubActive = isPathMatching(sub.path, activePath);

                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleNavClick(sub.path)}
                        data-testid={`submenu-item-${sub.id}`}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-sans transition-all cursor-pointer ${
                          isSubActive
                            ? 'bg-black text-white font-semibold shadow-xs'
                            : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/80'
                        }`}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Footer component (always visible, pinned, never overlaps)
  const renderFooter = () => (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-stone-300 border border-stone-400 flex items-center justify-center text-xs font-bold text-stone-800 shrink-0">
            {currentAdmin.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <span className="block text-xs font-bold text-stone-950 truncate leading-tight">
              {currentAdmin.display_name}
            </span>
            <span className="inline-flex items-center space-x-1 text-[10px] text-stone-500 font-medium">
              {currentAdmin.role === 'owner' ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-amber-600 inline" />
                  <span>Owner</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3 h-3 text-stone-600 inline" />
                  <span>Team</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="w-full py-2 px-3 rounded-full border-2 border-black bg-white hover:bg-stone-100 text-stone-950 text-xs font-serif font-bold flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Keluar</span>
      </button>
    </div>
  );

  return (
    <div
      className="min-h-screen flex bg-white font-sans text-stone-900 select-none antialiased"
      style={{
        ['--admin-sidebar-bg' as any]: sidebarBg,
        ['--admin-text' as any]: textColor,
        ['--admin-accent' as any]: accentColor,
      }}
    >
      {/* 1. Desktop Fixed Sidebar */}
      {/* Container is h-screen sticky top-0, flex flex-col, overflow-hidden */}
      <aside
        className="hidden md:flex flex-col w-64 shrink-0 border-r border-stone-300 h-screen sticky top-0 overflow-hidden"
        style={{ backgroundColor: sidebarBg }}
      >
        {/* Top: Logo & Company Name (flex-shrink-0) */}
        <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b border-stone-300/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 border-2 border-black flex items-center justify-center text-white shrink-0 shadow-md">
              {appSettings.logo_url ? (
                <img
                  src={appSettings.logo_url}
                  alt="Logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="font-serif font-bold text-base text-amber-300">
                  {appSettings.company_name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="overflow-hidden">
              <h1 className="font-serif font-bold text-sm text-stone-950 truncate leading-snug tracking-wide">
                {appSettings.company_name}
              </h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 font-semibold">
                Admin Portal
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Menu list (flex-1 min-h-0 overflow-y-auto, scrolls independently) */}
        <nav
          className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1 overscroll-contain"
          data-testid="admin-desktop-nav"
        >
          {renderMenuItems()}
          {/* Bottom spacer so the last menu item (Laporan) has plenty of breathing room */}
          <div className="h-8 shrink-0" aria-hidden="true" />
        </nav>

        {/* Bottom: Profile & Logout (flex-shrink-0, always visible, never clipped or covered) */}
        <div className="flex-shrink-0 p-4 border-t border-stone-300/80 bg-[var(--admin-sidebar-bg)] shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10">
          {renderFooter()}
        </div>
      </aside>

      {/* 2. Mobile Drawer Navigation (< 768px) */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            data-testid="mobile-drawer-backdrop"
          />
          {/* Sliding drawer */}
          <aside
            className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 flex flex-col border-r border-stone-300 overflow-hidden"
            style={{ backgroundColor: sidebarBg }}
            data-testid="mobile-drawer-panel"
          >
            {/* Drawer Header */}
            <div className="flex-shrink-0 p-4 border-b border-stone-300/60 flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-stone-900 border-2 border-black flex items-center justify-center text-white shrink-0 shadow-sm">
                  {appSettings.logo_url ? (
                    <img
                      src={appSettings.logo_url}
                      alt="Logo"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="font-serif font-bold text-xs text-amber-300">
                      {appSettings.company_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="overflow-hidden">
                  <h2 className="font-serif font-bold text-xs text-stone-950 truncate">
                    {appSettings.company_name}
                  </h2>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-stone-500 font-semibold block">
                    Admin Portal
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg border border-stone-300 text-stone-700 hover:text-black hover:bg-stone-200/60 transition-all cursor-pointer"
                aria-label="Tutup Menu"
                data-testid="mobile-drawer-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Navigation List */}
            <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1 overscroll-contain">
              {renderMenuItems()}
              <div className="h-8 shrink-0" aria-hidden="true" />
            </nav>

            {/* Drawer Footer */}
            <div className="flex-shrink-0 p-4 border-t border-stone-300/80 bg-[var(--admin-sidebar-bg)]">
              {renderFooter()}
            </div>
          </aside>
        </div>
      )}

      {/* 3. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-stone-200 px-4 md:px-8 flex items-center justify-between bg-white/95 sticky top-0 z-20 backdrop-blur-sm">
          {/* Mobile Hamburger + Breadcrumb */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 rounded-lg border-2 border-black text-stone-900 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
              aria-label="Buka Menu"
              data-testid="mobile-hamburger-btn"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation: Admin / Grup / Submenu */}
            <nav className="flex items-center space-x-1.5 text-xs text-stone-500" aria-label="Breadcrumb">
              <span
                onClick={() => onNavigate('/admin/dashboard')}
                className="font-serif font-medium text-stone-400 hover:text-stone-800 cursor-pointer transition-colors"
              >
                Admin
              </span>
              {breadcrumb.map((b, idx) => (
                <React.Fragment key={idx}>
                  <span className="text-stone-300">/</span>
                  <span
                    className={`${
                      idx === breadcrumb.length - 1
                        ? 'font-bold text-stone-900 font-serif'
                        : 'hover:text-stone-800 cursor-pointer font-medium text-stone-600 transition-colors'
                    }`}
                    onClick={() => b.path && onNavigate(b.path)}
                  >
                    {b.label}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Quick Branding Badge */}
          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-[11px] font-mono bg-stone-100 border border-stone-300 text-stone-700">
              {currentAdmin.username} ({currentAdmin.role})
            </span>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
