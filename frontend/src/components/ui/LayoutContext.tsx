import React, { createContext, useContext, useState } from 'react';

interface LayoutContextType {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => setMobileSidebarOpen((prev) => !prev);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <LayoutContext.Provider
      value={{
        mobileSidebarOpen,
        setMobileSidebarOpen,
        toggleMobileSidebar,
        closeMobileSidebar,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = (): LayoutContextType => {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return ctx;
};
