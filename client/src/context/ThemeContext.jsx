import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Read from localStorage, default to 'dark'
    return localStorage.getItem('chatapp-theme') || 'dark';
  });

  useEffect(() => {
    // Apply the data-theme attribute to <html> so CSS variables take effect globally
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chatapp-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
