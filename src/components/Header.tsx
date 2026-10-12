import type { Route } from "../hooks/useRoute";
import { RouteLink } from "./RouteLink";

interface HeaderProps {
  link?: { route: Route; label: string };
}

export function Header({ link }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="header-copy">
        <p className="eyebrow" translate="no">
          Marvel Master Watchlist
        </p>
        <h1 translate="no">Marvel Watchlist</h1>
        <p className="header-lead">
          Хронология Marvel: смотрите по порядку и пропускайте необязательное.
        </p>
      </div>
      {link ? (
        <RouteLink className="ghost-btn header-link" route={link.route}>
          {link.label}
        </RouteLink>
      ) : null}
    </header>
  );
}
