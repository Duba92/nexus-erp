import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useLanguageStore, type Language } from '@/src/store/useLanguageStore';
import { useTranslation } from '@/src/lib/i18n';
import { TranslationKey } from '@/src/lib/translations';
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  Users,
  FileText,
  Settings,
  LogOut,
  User,
  ChevronRight,
  Menu,
  Download,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/src/components/ui/sheet';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { useEffect } from 'react';

const navItems: { nameKey: string; path: string; icon: any; roles?: string[] }[] = [
  { nameKey: 'dashboard', path: '/', icon: LayoutDashboard },
  { nameKey: 'companies', path: '/companies', icon: Building2, roles: ['SUPER_ADMIN'] },
  { nameKey: 'pos', path: '/pos', icon: ShoppingCart },
  { nameKey: 'inventory', path: '/inventory', icon: Package },
  { nameKey: 'loans', path: '/loans', icon: FileText },
  { nameKey: 'employees', path: '/employees', icon: Users },
  { nameKey: 'expenses', path: '/expenses', icon: FileText },
  { nameKey: 'reports', path: '/reports', icon: FileText },
];

export default function DashboardLayout() {
  const { currentUser, currentCompany, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const filteredNavItems = navItems.filter(item => {
    if (!currentUser) return false;
    
    // If the item has role restrictions, check them first
    if (item.roles && !item.roles.includes(currentUser.role)) {
      return false;
    }

    // Super admin sees everything allowed by their role (which is everything)
    if (currentUser.role === 'SUPER_ADMIN') return true;
    
    // Company admin sees everything else (pos, inventory, etc)
    if (currentUser.role === 'COMPANY_ADMIN') return true;
    
    // Managers/Employees check permissions
    const featureMap: Record<string, string> = {
      '/inventory': 'inventory',
      '/pos': 'pos',
      '/employees': 'hr',
      '/reports': 'sales',
    };
    
    const featureKey = featureMap[item.path];
    const permissionAllowed = !featureKey || (currentUser.permissions?.includes(featureKey));
    
    return permissionAllowed;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-right bg-muted/30 md:flex">
        <div className="flex h-16 items-center px-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Building2 className="h-6 w-6 text-primary" />
            <span>Hullee</span>
          </Link>
        </div>
        <ScrollArea className="flex-1 px-3">
          <nav className="flex flex-col gap-1 py-4">
            {filteredNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  location.pathname === item.path ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.nameKey as any)}
              </Link>
            ))}
          </nav>
        </ScrollArea>
        <div className="p-4 border-top">
          <div className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-sm">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{currentUser?.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium">{currentUser?.fullName}</span>
              <span className="truncate text-xs text-muted-foreground capitalize">{currentUser?.role.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="md:hidden flex items-center gap-2 font-bold text-lg text-primary mr-2">
              <Building2 className="h-5 w-5" />
              <span>Hullee</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {currentCompany ? (
                <>
                  <span className="text-foreground">{currentCompany.name}</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : currentUser?.role === 'SUPER_ADMIN' ? (
                <>
                  <span className="text-foreground">{t('system_overview')}</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : null}
              <span>{t(navItems.find(i => i.path === location.pathname)?.nameKey || 'dashboard' as any)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {deferredPrompt && (
              <Button variant="outline" size="sm" onClick={handleInstall} className="hidden md:flex gap-2 bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100">
                <Download className="h-4 w-4" />
                Install
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" />}>
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{currentUser?.fullName.charAt(0)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUser?.fullName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{currentUser?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t('settings')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-muted/10 p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 z-50 w-full h-14 bg-background/95 backdrop-blur border-t md:hidden flex items-center justify-around px-2 pb-safe">
          {filteredNavItems.slice(0, 4).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[50px] transition-colors",
                location.pathname === item.path ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", location.pathname === item.path && "text-primary")} />
              <span className="text-[9px] truncate max-w-[50px]">{t(item.nameKey as any)}</span>
            </Link>
          ))}
          {/* More Menu for mobile if more than 4 items */}
          {filteredNavItems.length > 4 && (
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger render={
                <button className="flex flex-col items-center justify-center gap-0.5 min-w-[50px] text-muted-foreground">
                  <Menu className="h-4 w-4" />
                  <span className="text-[9px]">More</span>
                </button>
              } />
              <SheetContent side="bottom" className="h-[50vh] rounded-t-2xl">
                <ScrollArea className="h-full p-4">
                  <div className="grid grid-cols-3 gap-4">
                    {filteredNavItems.slice(4).map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-muted"
                      >
                        <div className="p-3 rounded-full bg-primary/10 text-primary">
                          <item.icon className="h-6 w-6" />
                        </div>
                        <span className="text-xs text-center font-medium">{t(item.nameKey as any)}</span>
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </nav>
      </div>
    </div>
  );
}
