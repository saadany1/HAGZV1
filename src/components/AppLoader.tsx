import React from 'react';
import { useAppData } from '../context/AppDataContext';
import SplashScreen from './SplashScreen';

interface AppLoaderProps {
  children: React.ReactNode;
}

const AppLoader: React.FC<AppLoaderProps> = ({ children }) => {
  const { isInitialLoading } = useAppData();

  if (isInitialLoading) {
    return <SplashScreen isDataLoading={isInitialLoading} />;
  }

  return <>{children}</>;
};


export default AppLoader;
