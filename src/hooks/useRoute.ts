import { useSyncExternalStore } from "react";

export type Route = "home" | "list";

const NAVIGATE_EVENT = "app:navigate";

/**
 * Базовый путь сайта: `/marvel-checklist/` на GitHub Pages, `/` локально.
 * Относительная база (`./`) трактуется как корень.
 */
function getBase(): string {
  const base = import.meta.env.BASE_URL;
  return base.startsWith("/") ? base : "/";
}

export function routeHref(route: Route): string {
  return route === "list" ? `${getBase()}list` : getBase();
}

function parseRoute(pathname: string): Route {
  const base = getBase();
  const relative = pathname.startsWith(base)
    ? pathname.slice(base.length)
    : pathname.replace(/^\/+/, "");
  return /^list\/?$/.test(relative) ? "list" : "home";
}

// Старые ссылки вида `/#/list` переводим на обычный адрес `/list`.
function migrateLegacyHash(): void {
  const { hash } = window.location;
  if (hash === "#/list" || hash === "#/list/") {
    window.history.replaceState(null, "", routeHref("list"));
  } else if (hash === "#/") {
    window.history.replaceState(null, "", routeHref("home"));
  }
}

migrateLegacyHash();

export function navigate(route: Route): void {
  const href = routeHref(route);
  if (window.location.pathname === href && !window.location.hash) {
    return;
  }
  window.history.pushState(null, "", href);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => parseRoute(window.location.pathname),
    () => "home",
  );
}
