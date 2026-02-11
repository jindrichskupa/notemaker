/**
 * Theme store - manages light/dark theme preference
 */

import { createSignal, createRoot } from "solid-js";

export type Theme = "dark" | "light";

function createThemeStore() {
  const [theme, setTheme] = createSignal<Theme>(
    (localStorage.getItem("notemaker:theme") as Theme) || "dark"
  );

  // Apply theme to document
  function applyTheme(newTheme: Theme) {
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("notemaker:theme", newTheme);
  }

  // Initialize theme on load
  applyTheme(theme());

  function toggleTheme() {
    const newTheme = theme() === "dark" ? "light" : "dark";
    setTheme(newTheme);
    applyTheme(newTheme);
  }

  function setThemeValue(newTheme: Theme) {
    setTheme(newTheme);
    applyTheme(newTheme);
  }

  return {
    theme,
    toggleTheme,
    setTheme: setThemeValue,
  };
}

export const themeStore = createRoot(createThemeStore);
