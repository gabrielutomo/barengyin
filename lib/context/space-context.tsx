"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type SpaceMode = "couple" | "personal";

interface SpaceContextType {
  space: SpaceMode;
  setSpace: (mode: SpaceMode) => void;
  toggleSpace: () => void;
  showSelectorModal: boolean;
  setShowSelectorModal: (show: boolean) => void;
  isPersonal: boolean;
  isCouple: boolean;
  goToPersonalSpace: () => void;
  goToCoupleSpace: () => void;
}

const SpaceContext = createContext<SpaceContextType | undefined>(undefined);

const STORAGE_KEY = "barengyin_active_space";
const PROMPT_KEY = "barengyin_prompt_space_after_login";

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // If path starts with /pribadi, space is definitely personal
  const isPribadiPath = pathname?.startsWith("/pribadi");

  const [space, setSpaceState] = useState<SpaceMode>(isPribadiPath ? "personal" : "couple");
  const [showSelectorModal, setShowSelectorModal] = useState<boolean>(false);

  useEffect(() => {
    // 1. Synchronize space with route
    if (pathname?.startsWith("/pribadi")) {
      setSpaceState("personal");
      try {
        localStorage.setItem(STORAGE_KEY, "personal");
      } catch (_) {}
    } else if (
      pathname?.startsWith("/dashboard") ||
      pathname?.startsWith("/transaksi") ||
      pathname?.startsWith("/dompet") ||
      pathname?.startsWith("/anggaran") ||
      pathname?.startsWith("/tabungan") ||
      pathname?.startsWith("/pasangan")
    ) {
      setSpaceState("couple");
      try {
        localStorage.setItem(STORAGE_KEY, "couple");
      } catch (_) {}
    } else {
      const savedSpace = localStorage.getItem(STORAGE_KEY) as SpaceMode | null;
      if (savedSpace === "personal" || savedSpace === "couple") {
        setSpaceState(savedSpace);
      }
    }

    // 2. Check if user just logged in and needs space choice prompt
    const shouldPrompt = sessionStorage.getItem(PROMPT_KEY);
    if (shouldPrompt === "true") {
      setShowSelectorModal(true);
      sessionStorage.removeItem(PROMPT_KEY);
    }
  }, [pathname]);

  const setSpace = (mode: SpaceMode) => {
    setSpaceState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) {}

    if (mode === "personal") {
      router.push("/pribadi");
    } else {
      router.push("/dashboard");
    }
  };

  const toggleSpace = () => {
    const next = space === "couple" ? "personal" : "couple";
    setSpace(next);
  };

  const goToPersonalSpace = () => {
    setSpace("personal");
  };

  const goToCoupleSpace = () => {
    setSpace("couple");
  };

  return (
    <SpaceContext.Provider
      value={{
        space,
        setSpace,
        toggleSpace,
        showSelectorModal,
        setShowSelectorModal,
        isPersonal: space === "personal",
        isCouple: space === "couple",
        goToPersonalSpace,
        goToCoupleSpace,
      }}
    >
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error("useSpace must be used within a SpaceProvider");
  }
  return context;
}
