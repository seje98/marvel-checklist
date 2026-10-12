import { Filters } from "../components/Filters";
import { Header } from "../components/Header";
import { MovieDetails } from "../components/MovieDetails";
import { MovieList } from "../components/MovieList";
import { OverallProgress } from "../components/OverallProgress";
import { RouteLink } from "../components/RouteLink";
import { Search } from "../components/Search";
import { Toast } from "../components/Toast";
import { Toolbar } from "../components/Toolbar";
import type { useMovies } from "../hooks/useMovies";
import type { useWatchlist } from "../hooks/useWatchlist";

interface WatchlistPageProps {
  watchlist: ReturnType<typeof useWatchlist>;
  moviesState: ReturnType<typeof useMovies>;
}

export function WatchlistPage({ watchlist, moviesState }: WatchlistPageProps) {
  const noMovies = watchlist.movies.length === 0;

  if (noMovies && !moviesState.loading) {
    return (
      <main className="app-shell">
        <h1 className="fatal-error">
          {moviesState.error ?? "Список проектов пуст."}
        </h1>
        <div className="fatal-actions">
          <button
            type="button"
            className="ghost-btn fatal-retry"
            onClick={() => void moviesState.refresh()}
          >
            Повторить загрузку
          </button>
          <RouteLink className="ghost-btn fatal-retry" route="list">
            Редактировать список
          </RouteLink>
        </div>
      </main>
    );
  }

  const loading = watchlist.loading || (noMovies && moviesState.loading);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#watchlist">
        Перейти к списку
      </a>
      <Header link={{ route: "list", label: "Редактировать список" }} />
      <OverallProgress stats={watchlist.overall} />

      {watchlist.loadError ? (
        <p className="banner banner-warning" role="status">
          {watchlist.loadError}
        </p>
      ) : null}
      {moviesState.error && !noMovies ? (
        <p className="banner banner-warning" role="status">
          {moviesState.error}
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
        {loading ? (
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
            episodesById={watchlist.episodesById}
            pendingIds={watchlist.pendingIds}
            collapsed={watchlist.collapsed}
            onToggleSection={watchlist.toggleSection}
            onToggleWatched={watchlist.toggleWatched}
            onSetEpisodes={watchlist.setEpisodes}
            onOpen={watchlist.openDetails}
          />
        )}
      </main>

      {watchlist.selectedMovie ? (
        <MovieDetails
          movie={watchlist.selectedMovie}
          watched={watchlist.watchedIds.has(watchlist.selectedMovie.id)}
          watchedEpisodes={watchlist.episodesById.get(watchlist.selectedMovie.id) ?? 0}
          pending={watchlist.pendingIds.has(watchlist.selectedMovie.id)}
          onToggle={watchlist.toggleWatched}
          onSetEpisodes={watchlist.setEpisodes}
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
