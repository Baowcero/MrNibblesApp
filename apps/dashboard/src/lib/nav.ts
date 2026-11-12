export type Role = 'ceo' | 'sales' | 'accounts' | 'production' | 'store_keeper';

export interface NavItem { href: string; label: string; icon: string; roles: Role[] }

/** The sidebar shows only what the logged-in role may use. The API enforces the same rules. */
export const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: 'home', roles: ['ceo', 'accounts'] },
  { href: '/orders', label: 'Orders', icon: 'orders', roles: ['ceo', 'sales', 'accounts'] },
  { href: '/customers', label: 'Customers', icon: 'people', roles: ['ceo', 'sales'] },
  { href: '/reports', label: 'Reports', icon: 'chart', roles: ['ceo', 'accounts'] },
  { href: '/payments', label: 'Payments', icon: 'wallet', roles: ['ceo', 'accounts'] },
  { href: '/production', label: 'Production', icon: 'bread', roles: ['ceo', 'production'] },
  { href: '/inventory', label: 'Inventory', icon: 'box', roles: ['ceo', 'store_keeper', 'production'] },
  { href: '/issues', label: 'Issues', icon: 'alert', roles: ['ceo', 'sales', 'accounts'] },
  { href: '/reconciliation', label: 'Reconciliation', icon: 'check', roles: ['ceo', 'sales', 'accounts'] },
  { href: '/team', label: 'Team', icon: 'team', roles: ['ceo'] },
];

export const navFor = (roles: string[]) => NAV.filter((n) => n.roles.some((r) => roles.includes(r)));
export const homeFor = (roles: string[]) => navFor(roles)[0]?.href ?? '/login';
