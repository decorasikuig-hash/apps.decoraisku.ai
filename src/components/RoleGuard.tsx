import React from 'react';
import { Role, DBState } from '../types';

interface RoleGuardProps {
  allowedRoles: Role[];
  userRole: Role;
  menuId?: string; // Menu ID for dynamic custom roles checking
  dbState?: DBState;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const checkPermission = (userRole: string, menuId: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view', dbState?: DBState): boolean => {
  if (userRole === 'super_admin') return true;

  if (dbState?.roles) {
    const customRole = dbState.roles.find(r => r.id === userRole);
    if (customRole) {
      if (action === 'view') {
        return customRole.permissions.includes(`${menuId}_view`) || customRole.permissions.includes(menuId);
      }
      return customRole.permissions.includes(`${menuId}_${action}`);
    }
  }

  return false;
};

export const checkTabPermission = (userRole: string, parentMenuId: string, tabSubId: string, dbState?: DBState): boolean => {
  if (userRole === 'super_admin') return true;

  // First check if user can view the parent page/module.
  if (!checkPermission(userRole, parentMenuId, 'view', dbState)) {
    return false;
  }

  if (dbState?.roles) {
    const customRole = dbState.roles.find(r => r.id === userRole);
    if (customRole) {
      const fullTabId = `${parentMenuId}_tab-${tabSubId}`;
      
      // Check if this custom role has ANY tab permission configured for this parent page
      const hasAnyTabConfig = customRole.permissions.some(p => 
        p.startsWith(`${parentMenuId}_tab-`)
      );

      if (hasAnyTabConfig) {
        return customRole.permissions.includes(fullTabId) || 
               customRole.permissions.includes(`${fullTabId}_view`);
      }
    }
  }

  return true;
};

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, userRole, menuId, dbState, children, fallback = null }) => {
  // Super admin always has access
  if (userRole === 'super_admin') return <>{children}</>;
  
  // Custom roles logic
  if (dbState?.roles && menuId) {
    const customRole = dbState.roles.find(r => r.id === userRole);
    if (customRole) {
      if (customRole.permissions.includes(menuId) || customRole.permissions.includes(`${menuId}_view`)) {
        return <>{children}</>;
      }
      return <>{fallback}</>;
    }
  }

  // Fallback to legacy static allowed roles
  if (allowedRoles.includes(userRole)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
