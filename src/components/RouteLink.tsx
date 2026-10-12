import type { MouseEvent, ReactNode } from "react";
import { navigate, routeHref, type Route } from "../hooks/useRoute";

interface RouteLinkProps {
  route: Route;
  className?: string;
  children: ReactNode;
}

/** Ссылка на страницу приложения: переход без перезагрузки, адрес без `#`. */
export function RouteLink({ route, className, children }: RouteLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(route);
  };

  return (
    <a className={className} href={routeHref(route)} onClick={onClick}>
      {children}
    </a>
  );
}
