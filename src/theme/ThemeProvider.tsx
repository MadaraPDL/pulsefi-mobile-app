import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
} from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useColorScheme } from "react-native";

import {
  pulseFiDarkColors,
  pulseFiLightColors,
  type PulseFiColors,
  type PulseFiThemeMode,
} from "./colors";

const THEME_STORAGE_KEY = "pulsefi-mobile-theme";

type PulseFiThemeContextValue = {
  mode: PulseFiThemeMode;
  colors: PulseFiColors;
  navigationTheme: NavigationTheme;
  setMode: (mode: PulseFiThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
};

const PulseFiThemeContext = createContext<PulseFiThemeContextValue | null>(null);

function buildNavigationTheme(colors: PulseFiColors): NavigationTheme {
  const baseTheme = colors.mode === "dark" ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    dark: colors.mode === "dark",
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };
}

export function PulseFiThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<PulseFiThemeMode>(
    systemScheme === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    async function loadSavedTheme() {
      const savedMode = await SecureStore.getItemAsync(THEME_STORAGE_KEY);

      if (savedMode === "light" || savedMode === "dark") {
        setModeState(savedMode);
      }
    }

    void loadSavedTheme();
  }, []);

  const colors = mode === "dark" ? pulseFiDarkColors : pulseFiLightColors;
  const navigationTheme = useMemo(() => buildNavigationTheme(colors), [colors]);

  const setMode = useCallback(async (nextMode: PulseFiThemeMode) => {
    setModeState(nextMode);
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, nextMode);
  }, []);

  const toggleMode = useCallback(async () => {
    await setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({
      mode,
      colors,
      navigationTheme,
      setMode,
      toggleMode,
    }),
    [colors, mode, navigationTheme, setMode, toggleMode]
  );

  return (
    <PulseFiThemeContext.Provider value={value}>
      {children}
    </PulseFiThemeContext.Provider>
  );
}

export function usePulseFiTheme() {
  const context = useContext(PulseFiThemeContext);

  if (!context) {
    throw new Error("usePulseFiTheme must be used inside PulseFiThemeProvider.");
  }

  return context;
}
