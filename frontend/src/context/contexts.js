import { createContext, useContext } from "react";

export const ThemeContext = createContext(null);
export const ToastContext = createContext(null);
export const LibraryContext = createContext(null);
export const CommandContext = createContext(null);

export const useTheme = () => useContext(ThemeContext);
export const useToast = () => useContext(ToastContext);
export const useLibrary = () => useContext(LibraryContext);
export const useCommand = () => useContext(CommandContext);
