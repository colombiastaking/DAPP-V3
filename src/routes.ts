// Add import for Migration page
import { ComponentType } from 'react';
import { dAppName } from 'config';
import withPageTitle from './components/PageTitle';

import { Admin } from './pages/Admin';
import { Dashboard } from './pages/Dashboard';
import { Home } from './pages/Home';
import { Delegation } from './pages/Delegation';
import { Stake } from './pages/Stake';
import { Simulation } from './pages/Simulation';
import { Migration } from './pages/Migration'; // Ensure import

export interface RouteType {
  path: string;
  title: string;
  authenticatedRoute?: boolean;
  component: ComponentType;
}

export const routeNames = {
  home: '/',
  user: '/user',
  dashboard: '/dashboard',
  delegation: '/delegate',
  stake: '/stake',
  simulation: '/simulation',
  migration: '/migration', // Ensure route name
  transaction: '/transaction',
  unlock: '/unlock',
  ledger: '/ledger',
  walletconnect: '/walletconnect',
  admin: '/admin'
};

const routes: RouteType[] = [
  {
    path: routeNames.home,
    title: 'Home',
    component: Home
  },
  {
    path: routeNames.user,
    title: 'User',
    component: Home,
    authenticatedRoute: true
  },
  {
    path: routeNames.dashboard,
    title: 'Dashboard',
    component: Dashboard,
    authenticatedRoute: true
  },
  {
    path: routeNames.delegation,
    title: 'Delegation',
    component: Delegation,
    authenticatedRoute: true
  },
  {
    path: routeNames.stake,
    title: 'Stake',
    component: Stake,
    authenticatedRoute: true
  },
  {
    path: routeNames.simulation,
    title: 'Simulation',
    component: Simulation,
    authenticatedRoute: true
  },
  {
    path: routeNames.migration,
    title: 'Migration',
    component: Migration,
    authenticatedRoute: true
  },
  {
    path: routeNames.admin,
    title: 'Admin',
    component: Admin
  }
];

const mappedRoutes = routes.map((route) => {
  const title = route.title
    ? `${route.title} • MultiversX ${dAppName}`
    : `MultiversX ${dAppName}`;

  const requiresAuth = Boolean(route.authenticatedRoute);
  const wrappedComponent = withPageTitle(title, route.component);

  return {
    path: route.path,
    component: wrappedComponent,
    authenticatedRoute: requiresAuth
  };
});

export default mappedRoutes;
