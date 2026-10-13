"use client";

import { SpaceProvider } from "@/lib/context/space-context";
import { SpaceSelectorModal } from "@/components/space-selector-modal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SpaceProvider>
      {children}
      <SpaceSelectorModal />
    </SpaceProvider>
  );
}
