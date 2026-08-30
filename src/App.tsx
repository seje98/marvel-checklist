import { Filters } from "./components/Filters";
import { Header } from "./components/Header";
import { MovieDetails } from "./components/MovieDetails";
import { MovieList } from "./components/MovieList";
import { OverallProgress } from "./components/OverallProgress";
import { Search } from "./components/Search";
import { Toast } from "./components/Toast";
import { Toolbar } from "./components/Toolbar";
import { useWatchlist } from "./hooks/useWatchlist";

export default function App() {
  const watchlist = useWatchlist();

  if (watchlist.movies.length === 0) {
    return (
      <main className="app-shell">
        <h1 className="fatal-error">Не удалось загрузить список проектов.</h1>
        <button
          type="button"
          className="ghost-btn fatal-retry"
          onClick={() => window.location.reload()}
        >
          Обновить страницу
        </button>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#watchlist">
        Перейти к списку
      </a>
      <Header />
      <OverallProgress stats={watchlist.overall} />

      {watchlist.loadError ? (
        <p className="banner banner-warning" role="status">
          {watchlist.loadError}
        </p>
      ) : null}

      <div className="box-office">
        <div className="box-office-core">
          <Search value={watchlist.query} onChange={watchlist.setQuery} />
          <Filters
            status={watchlist.filters.status}
            importance={watchlist.filters.importance}
            canon={watchlist.filters.canon}
            type={watchlist.filters.type}
            onStatus={watchlist.setStatus}
            onImportance={watchlist.setImportance}
            onCanon={watchlist.setCanon}
            onType={watchlist.setType}
          />
          <Toolbar
            filtersActive={watchlist.filtersActive}
            onReset={watchlist.resetFilters}
            onCollapseAll={watchlist.collapseAll}
            onExpandAll={watchlist.expandAll}
            visibleCount={watchlist.filteredCount}
            totalCount={watchlist.totalCount}
          />
        </div>
      </div>

      <main id="watchlist" className="watchlist">
        {watchlist.loading ? (
          <div className="skeleton-list" aria-busy="true" aria-live="polite">
            <div className="skeleton-core">
              <p className="loading-label">Загрузка списка:</p>
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton-card" aria-hidden="true">
                  <div className="skeleton-check" />
                  <div className="skeleton-copy">
                    <span className="skeleton-line skeleton-line-sm" />
                    <span className="skeleton-line skeleton-line-lg" />
                    <span className="skeleton-line skeleton-line-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <MovieList
            sections={watchlist.sections}
            watchedIds={watchlist.watchedIds}
            pendingIds={watchlist.pendingIds}
            collapsed={watchlist.collapsed}
            onToggleSection={watchlist.toggleSection}
            onToggleWatched={watchlist.toggleWatched}
            onOpen={watchlist.openDetails}
          />
        )}
      </main>

      {watchlist.selectedMovie ? (
        <MovieDetails
          movie={watchlist.selectedMovie}
          watched={watchlist.watchedIds.has(watchlist.selectedMovie.id)}
          pending={watchlist.pendingIds.has(watchlist.selectedMovie.id)}
          onToggle={watchlist.toggleWatched}
          onClose={watchlist.closeDetails}
        />
      ) : null}

      <Toast
        toasts={watchlist.toasts}
        onDismiss={watchlist.dismissToast}
        onAction={watchlist.applyToastAction}
      />
    </div>
  );
}
