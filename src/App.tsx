import { Route, Routes, BrowserRouter, Navigate } from 'react-router-dom';

import { Layout } from 'components/Layout';
import { ContextProvider } from 'context';
import { PageNotFound } from 'pages/PageNotFound';
import { Unlock } from 'pages/Unlock';
import routes, { RouteType, routeNames } from 'routes';

import { ColsAprProvider } from './context/ColsAprContext';

export const App = () => (
  <BrowserRouter>
    <ContextProvider>
      <ColsAprProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to={routeNames.unlock} replace />} />
            <Route path={routeNames.unlock} element={<Unlock />} />

            {routes.map((route: Omit<RouteType, 'title'>, index: number) => (
              <Route
                path={route.path}
                key={'route-key-' + index}
                element={<route.component />}
              />
            ))}

            <Route element={<PageNotFound />} />
          </Routes>
        </Layout>
      </ColsAprProvider>
    </ContextProvider>
  </BrowserRouter>
);
