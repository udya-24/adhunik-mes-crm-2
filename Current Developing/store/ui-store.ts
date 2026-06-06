"use client";

import { create } from "zustand";

type UiStore = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false })
}));
