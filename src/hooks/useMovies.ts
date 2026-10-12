import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMovie,
  deleteMovie,
  getMovies,
  type MovieDraft,
  updateMovie,
  updateMovieOrder,
} from "../api/movies";
import { notifyChanged } from "../realtime/notify";
import type { Movie } from "../types/movie";
import { loadMoviesCache, saveMoviesCache } from "../utils/storage";

// Mokky теряет часть обновлений при параллельных записях в одну коллекцию,
// поэтому порядок пересчитывается строго последовательно.
const ORDER_CONCURRENCY = 1;

function sortByOrder(movies: Movie[]): Movie[] {
  return movies.slice().sort((a, b) => a.order - b.order);
}

function sameMovies(a: Movie[], b: Movie[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function runLimited(tasks: (() => Promise<unknown>)[]): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(ORDER_CONCURRENCY, tasks.length) },
    async () => {
      while (next < tasks.length) {
        const task = tasks[next++];
        await task();
      }
    },
  );
  await Promise.all(workers);
}

export interface SaveMovieInput {
  /** `id` существующего проекта; без него создаётся новый. */
  existingId?: string;
  /** Поля проекта; `order` вычисляется из позиции. */
  draft: Omit<MovieDraft, "order">;
  /** Позиция в списке, начиная с 1. Без значения: сохранить текущую / в конец. */
  position?: number;
}

export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>(() => sortByOrder(loadMoviesCache()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const moviesRef = useRef(movies);
  const mutationRef = useRef<Promise<unknown>>(Promise.resolve());
  const activeMutationsRef = useRef(0);
  const mutationEpochRef = useRef(0);

  const applyMovies = useCallback((next: Movie[]) => {
    const sorted = sortByOrder(next);
    if (sameMovies(moviesRef.current, sorted)) {
      return;
    }
    moviesRef.current = sorted;
    setMovies(sorted);
    saveMoviesCache(sorted);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyMovies(await getMovies());
      setError(null);
    } catch {
      setError(
        moviesRef.current.length > 0
          ? "Не удалось обновить список проектов. Показана сохранённая копия."
          : "Не удалось загрузить список проектов.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyMovies]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onOnline = () => {
      void refresh();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);

  // Мутации выполняются строго по очереди, чтобы пересчёт порядка не пересекался.
  // После неудачной мутации список перечитывается: часть записей могла измениться.
  const enqueue = useCallback(
    <T,>(task: () => Promise<T>): Promise<T> => {
      const guarded = async () => {
        if (moviesRef.current.some((movie) => movie.recordId === undefined)) {
          throw new Error("Список доступен только для чтения");
        }
        try {
          return await task();
        } catch (failure) {
          await refresh();
          throw failure;
        }
      };
      activeMutationsRef.current += 1;
      mutationEpochRef.current += 1;
      const run = mutationRef.current.then(guarded, guarded);
      mutationRef.current = run
        .catch(() => undefined)
        .then(() => {
          activeMutationsRef.current -= 1;
          mutationEpochRef.current += 1;
        });
      return run;
    },
    [refresh],
  );

  /**
   * Тихая сверка для периодического опроса: без сообщений об ошибках.
   * Пропускается во время правок, а устаревший ответ отбрасывается.
   */
  const poll = useCallback(async (): Promise<boolean> => {
    if (activeMutationsRef.current > 0) {
      return false;
    }
    const epoch = mutationEpochRef.current;
    try {
      const fresh = await getMovies();
      if (activeMutationsRef.current > 0 || epoch !== mutationEpochRef.current) {
        return false;
      }
      const before = moviesRef.current;
      applyMovies(fresh);
      return moviesRef.current !== before;
    } catch {
      return false;
    }
  }, [applyMovies]);

  /** Присваивает порядок 1..n и отправляет только изменившиеся записи. */
  const renumber = useCallback(
    async (ordered: Movie[], skipRecordId?: number): Promise<Movie[]> => {
      const result = ordered.map((movie, index) => ({ ...movie, order: index + 1 }));
      const tasks: (() => Promise<unknown>)[] = [];
      result.forEach((movie, index) => {
        if (
          movie.order !== ordered[index].order &&
          movie.recordId !== undefined &&
          movie.recordId !== skipRecordId
        ) {
          const { recordId, order } = movie;
          tasks.push(() => updateMovieOrder(recordId, order));
        }
      });
      await runLimited(tasks);
      return result;
    },
    [],
  );

  const saveMovie = useCallback(
    (input: SaveMovieInput): Promise<Movie> =>
      enqueue(async () => {
        const current = sortByOrder(moviesRef.current);
        const existing = input.existingId
          ? current.find((movie) => movie.id === input.existingId)
          : undefined;

        if (input.existingId && !existing) {
          throw new Error("Проект не найден");
        }

        const others = current.filter((movie) => movie !== existing);
        const fallbackIndex = existing ? current.indexOf(existing) : others.length;
        const index =
          input.position === undefined
            ? fallbackIndex
            : Math.min(Math.max(Math.trunc(input.position) - 1, 0), others.length);

        let saved: Movie;
        if (existing && existing.recordId !== undefined) {
          saved = await updateMovie(existing.recordId, {
            ...input.draft,
            id: existing.id,
            order: index + 1,
          });
        } else {
          saved = await createMovie({
            ...input.draft,
            id: input.draft.id,
            order: index + 1,
          });
        }

        const ordered = [...others];
        ordered.splice(index, 0, saved);
        const result = await renumber(ordered, saved.recordId);
        applyMovies(result);
        notifyChanged("movies");
        return result[index];
      }),
    [applyMovies, enqueue, renumber],
  );

  const moveMovie = useCallback(
    (id: string, position: number): Promise<void> => {
      const current = sortByOrder(moviesRef.current);
      const movie = current.find((item) => item.id === id);
      if (!movie) {
        return Promise.resolve();
      }
      if (current.some((item) => item.recordId === undefined)) {
        return Promise.reject(new Error("Список доступен только для чтения"));
      }

      const others = current.filter((item) => item !== movie);
      const index = Math.min(Math.max(Math.trunc(position) - 1, 0), others.length);
      const ordered = [...others];
      ordered.splice(index, 0, movie);
      if (ordered.every((item, i) => item === current[i])) {
        return Promise.resolve();
      }

      // Новый порядок показывается сразу; запросы к серверу идут следом.
      // При ошибке список перечитывается (см. enqueue) и откатывается.
      const optimistic = ordered.map((item, i) => ({ ...item, order: i + 1 }));
      applyMovies(optimistic);

      return enqueue(async () => {
        const tasks: (() => Promise<unknown>)[] = [];
        optimistic.forEach((item, i) => {
          if (item.order !== ordered[i].order && item.recordId !== undefined) {
            const { recordId, order } = item;
            tasks.push(() => updateMovieOrder(recordId, order));
          }
        });
        await runLimited(tasks);
        notifyChanged("movies");
      });
    },
    [applyMovies, enqueue],
  );

  const removeMovie = useCallback(
    (id: string): Promise<void> =>
      enqueue(async () => {
        const movie = moviesRef.current.find((item) => item.id === id);
        if (!movie) {
          return;
        }
        if (movie.recordId !== undefined) {
          await deleteMovie(movie.recordId);
        }
        const remaining = sortByOrder(moviesRef.current).filter((item) => item.id !== id);
        // Порядок остаётся сплошным (1..n): сдвигаются только записи после удалённой.
        applyMovies(await renumber(remaining));
        notifyChanged("movies");
      }),
    [applyMovies, enqueue, renumber],
  );

  const movieById = useMemo(
    () => new Map(movies.map((movie) => [movie.id, movie])),
    [movies],
  );

  // Записи без числового id Mokky нельзя изменить: список только для чтения.
  const readOnly = useMemo(
    () => movies.some((movie) => movie.recordId === undefined),
    [movies],
  );

  return {
    movies,
    movieById,
    readOnly,
    loading,
    error,
    refresh,
    poll,
    saveMovie,
    moveMovie,
    removeMovie,
  };
}
