import React from 'react';
import {
  LayoutDashboard,
  Send,
  Settings,
  MessageCircle,
  Smartphone,
  Bot,
  History,
  Shield,
  GitBranch,
  FileText,
  FlaskConical,
  Calendar,
  LogOut,
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

export type AppView =
  | 'dashboard'
  | 'campaign'
  | 'settings'
  | 'history'
  | 'blacklist';

interface AppSidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const mainItems = [
  { id: 'dashboard' as AppView, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'campaign' as AppView, label: 'Nova Campanha', icon: Send },
  { id: 'history' as AppView, label: 'Histórico', icon: History },
  { id: 'blacklist' as AppView, label: 'Blacklist', icon: Shield },
];

const settingsItems = [
  { id: 'settings' as AppView, label: 'Configurações', icon: Settings },
];

export function AppSidebar({ currentView, onViewChange }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent>
        {/* Logo */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-primary" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="font-bold text-sm leading-none">MessageFlow</p>
                <p className="text-[10px] text-muted-foreground">Automação WhatsApp</p>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
