import type { Movie } from "../types/movie";
import { getProgress, type SectionGroup } from "../utils/progress";
import { MovieItem } from "./MovieItem";
import { SectionProgress } from "./SectionProgress";

interface MovieListProps {
  sections: SectionGroup[];
  watchedIds: ReadonlySet<string>;
  pendingIds: ReadonlySet<string>;
  collapsed: ReadonlySet<number>;
  onToggleSection: (section: number) => void;
  onToggleWatched: (id: string) => void;
  onOpen: (id: string) => void;
}

export function MovieList({
  sections,
  watchedIds,
  pendingIds,
  collapsed,
  onToggleSection,
  onToggleWatched,
  onOpen,
}: MovieListProps) {
  if (sections.length === 0) {
    return (
      <div className="empty-shell">
        <p className="empty-state">Ничего не найдено. Сбросьте фильтры или измените запрос.</p>
      </div>
    );
  }

  return (
    <div className="movie-list">
      {sections.map((group) => {
        const stats = getProgress(group.movies, watchedIds);
        const isCollapsed = collapsed.has(group.section);

        return (
          <section key={group.section} className="section-block">
            <div className="section-core">
              <SectionProgress
                section={group.section}
                title={group.title}
                stats={stats}
                collapsed={isCollapsed}
                onToggle={() => onToggleSection(group.section)}
              />
              {isCollapsed ? null : (
                <div className="section-items">
                  {group.movies.map((movie: Movie) => (
                    <MovieItem
                      key={movie.id}
                      movie={movie}
                      watched={watchedIds.has(movie.id)}
                      pending={pendingIds.has(movie.id)}
                      onToggle={onToggleWatched}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
