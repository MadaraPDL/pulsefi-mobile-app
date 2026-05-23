import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

type SelectedRouterContextValue = {
  selectedRouterId: string | null;
  setSelectedRouterId: (routerId: string | null) => void;
};

const SelectedRouterContext =
  createContext<SelectedRouterContextValue | null>(null);

export function SelectedRouterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      selectedRouterId,
      setSelectedRouterId,
    }),
    [selectedRouterId]
  );

  return (
    <SelectedRouterContext.Provider value={value}>
      {children}
    </SelectedRouterContext.Provider>
  );
}

export function useSelectedRouter() {
  const value = useContext(SelectedRouterContext);

  if (!value) {
    throw new Error(
      "useSelectedRouter must be used inside SelectedRouterProvider"
    );
  }

  return value;
}
