import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export type UsageDisplaySource = "official" | "estimated";

type SelectedRouterContextValue = {
  selectedRouterId: string | null;
  setSelectedRouterId: (routerId: string | null) => void;
  usageDisplaySource: UsageDisplaySource;
  setUsageDisplaySource: (source: UsageDisplaySource) => void;
};

const SelectedRouterContext =
  createContext<SelectedRouterContextValue | null>(null);

export function SelectedRouterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null);
  const [usageDisplaySource, setUsageDisplaySource] =
    useState<UsageDisplaySource>("estimated");

  const value = useMemo(
    () => ({
      selectedRouterId,
      setSelectedRouterId,
      usageDisplaySource,
      setUsageDisplaySource,
    }),
    [selectedRouterId, usageDisplaySource]
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
