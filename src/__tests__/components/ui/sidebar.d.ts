declare module '@/components/ui/sidebar' {
  import React from 'react';
  export const SidebarProvider: React.FC<{ children?: React.ReactNode; collapsible?: string; side?: string; [key: string]: any }>;
  export const Sidebar: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarTrigger: React.FC<{ [key: string]: any }>;
  export const SidebarContent: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarHeader: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarFooter: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarGroup: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarGroupLabel: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarGroupContent: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarMenu: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarMenuItem: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarMenuButton: React.FC<{ children?: React.ReactNode; showIcon?: boolean; [key: string]: any }>;
  export const SidebarSeparator: React.FC<{ [key: string]: any }>;
  export const SidebarRail: React.FC<{ [key: string]: any }>;
  export const SidebarInset: React.FC<{ children?: React.ReactNode; [key: string]: any }>;
  export const SidebarInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { [key: string]: any }>;
  export const SidebarMenuSkeleton: React.FC<{ [key: string]: any }>;
}
