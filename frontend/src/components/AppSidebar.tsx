import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Send,
  Settings,
  History,
  Shield,
  LogOut,
  X,
  User,
  LogIn,
  Crown,
  BarChart3,
  Home,
  Link2,
  Users,
  List,
  Globe,
  Phone,
  Building2,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from './AuthModal';

export type AppView =
  | 'home'
  | 'dashboard'
  | 'campaign'
  | 'settings'
  | 'history'
  | 'blacklist'
  | 'links'
  | 'groups-send'
  | 'lists'
  | 'group-scraper'
  | 'chip-maturer'
  | 'business-search'
  | 'admin';

interface AppSidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const mainItems = [
  { id: 'home' as AppView, label: 'Campanhas', icon: Home },
  { id: 'dashboard' as AppView, label: 'Dashboard', icon: BarChart3 },
  { id: 'groups-send' as AppView, label: 'Disparo em Grupos', icon: Users },
  { id: 'links' as AppView, label: 'Gerador de Links', icon: Link2 },
  { id: 'history' as AppView, label: 'Histórico', icon: History },
  { id: 'blacklist' as AppView, label: 'Blacklist', icon: Shield },
];

const listsItems = [
  { id: 'lists' as AppView, label: 'Listas de Contatos', icon: List },
];

const toolsItems = [
  { id: 'business-search' as AppView, label: 'Buscar Empresas', icon: Building2 },
  { id: 'group-scraper' as AppView, label: 'Buscar Grupos', icon: Globe },
  { id: 'chip-maturer' as AppView, label: 'Maturador de Chip', icon: Phone },
];

const settingsItems = [
  { id: 'settings' as AppView, label: 'Configurações', icon: Settings },
];

const adminItems = [
  { id: 'admin' as AppView, label: 'Admin', icon: Crown },
];

export function AppSidebar({ currentView, onViewChange }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, profile, isSuperadmin, trialDaysLeft, loading, signOut } = useAuth();

  // Auto-close modal when logged in
  useEffect(() => {
    if (user && authModalOpen) {
      setAuthModalOpen(false);
    }
  }, [user, authModalOpen]);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent>
        {/* Logo */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setLogoModalOpen(true)}
            >
              <img src="/logo-nexia.png" alt="Nexia" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="font-bold text-sm leading-none">Nexia</p>
                <p className="text-[10px] text-muted-foreground">Mais alcance, menos esforço</p>
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={currentView === item.id}
                    tooltip={item.label}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Contact Lists */}
        <SidebarGroup>
          <SidebarGroupLabel>Contatos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {listsItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={currentView === item.id}
                    tooltip={item.label}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel>Ferramentas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={currentView === item.id}
                    tooltip={item.label}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <a
                  href="https://chipsms.com.br/cadastro/?indicacao=gleicileneteixeira.gd@gmail.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm text-green-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4 shrink-0" />
                  <span className="flex-1">Comprar Número</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                </a>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={currentView === item.id}
                    tooltip={item.label}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isSuperadmin && adminItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={currentView === item.id}
                    tooltip={item.label}
                  >
                    <item.icon className="w-4 h-4 text-primary" />
                    <span className="text-primary font-medium">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Section */}
      <SidebarFooter>
        {!loading && (
          <div className="p-2">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSignOut}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {!collapsed && <span>Sair</span>}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {!collapsed && <span>Entrar</span>}
              </button>
            )}
          </div>
        )}
      </SidebarFooter>

      {/* Logo Modal */}
      <Dialog open={logoModalOpen} onOpenChange={setLogoModalOpen}>
        <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Nexia</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-4">
            <img 
              src="/logo-nexia.png" 
              alt="Logo Nexia" 
              className="max-w-full max-h-[60vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </Sidebar>
  );
}
