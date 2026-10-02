import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getWatchedFilms,
  markFilmAsWatched,
  unmarkFilmAsWatched,
} from "../api/mokky";
import moviesData from "../data/movies.json";
import type {
  CanonFilter,
  ImportanceFilter,
  Movie,
  PendingChange,
  SyncStatus,
  ToastAction,
  ToastMessage,
  TypeFilter,
  WatchedEntry,
  WatchStatusFilter,
} from "../types/movie";
import {
  hasActiveFilters,
  matchesCanon,
  matchesImportance,
  matchesSearch,
  matchesStatus,
  matchesType,
} from "../utils/filters";
import {
  getProgress,
  getWatchedEpisodes,
  groupBySection,
  hasEpisodes,
  isFullyWatched,
} from "../utils/progress";
import {
  cacheFromMap,
  DEFAULT_FILTERS,
  loadCollapsed,
  loadFilters,
  loadQueue,
  loadWatchedCache,
  mapFromCache,
  saveCollapsed,
  saveFilters,
  saveQueue,
  saveWatchedCache,
} from "../utils/storage";

const movies = moviesData as Movie[];
const movieById = new Map(movies.map((movie) => [movie.id, movie]));

const EPISODES_SYNC_DELAY_MS = 600;

let toastSeq = 1;

function enqueueChange(
  queue: PendingChange[],
  change: PendingChange,
): PendingChange[] {
  const next = queue.filter((item) => item.filmId !== change.filmId);
  next.push(change);
  return next;
}

function applyChangeToMap(
  map: Map<string, WatchedEntry>,
  change: PendingChange,
): Map<string, WatchedEntry> {
  const next = new Map(map);
  if (change.action === "unwatch") {
    next.delete(change.filmId);
  } else {
    next.set(change.filmId, {
      recordId: map.get(change.filmId)?.recordId ?? null,
      ...(change.episodes !== undefined ? { episodes: change.episodes } : {}),
    });
  }
  return next;
}

export function useWatchlist() {
  const [watchedMap, setWatchedMap] = useState<Map<string, WatchedEntry>>(
    () => mapFromCache(loadWatchedCache()),
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState(loadFilters);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(
    () => new Set(loadCollapsed()),
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usingLocal, setUsingLocal] = useState(false);

  const watchedMapRef = useRef(watchedMap);
  const queueRef = useRef<PendingChange[]>(loadQueue());
  const flushRef = useRef<Promise<boolean> | null>(null);
  const episodesTimerRef = useRef(0);
  const pendingRef = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    saveWatchedCache(cacheFromMap(watchedMap));
  }, [watchedMap]);

  // Ref обновляется синхронно, чтобы быстрые подряд идущие нажатия «+1»
  // видели актуальное значение, а не состояние предыдущего рендера.
  const updateWatchedMap = useCallback(
    (update: (current: Map<string, WatchedEntry>) => Map<string, WatchedEntry>) => {
      const next = update(watchedMapRef.current);
      if (next === watchedMapRef.current) {
        return;
      }
      watchedMapRef.current = next;
      setWatchedMap(next);
    },
    [],
  );

  const pushToast = useCallback(
    (type: ToastMessage["type"], text: string, action?: ToastAction) => {
      const id = toastSeq++;
      setToasts((current) => [...current, { id, type, text, action }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 1800);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const applyRemoteWatched = useCallback(
    (records: { id: number; filmId: string; episodes?: number }[]) => {
      let next = new Map<string, WatchedEntry>();
      for (const record of records) {
        if (!next.has(record.filmId)) {
          next.set(record.filmId, {
            recordId: record.id,
            ...(record.episodes !== undefined ? { episodes: record.episodes } : {}),
          });
        }
      }
      // Ещё не отправленные локальные изменения важнее серверного состояния.
      for (const change of queueRef.current) {
        next = applyChangeToMap(next, change);
      }
      watchedMapRef.current = next;
      setWatchedMap(next);
      saveWatchedCache(cacheFromMap(next));
    },
    [],
  );

  // Один общий проход по очереди: изменения, добавленные во время отправки
  // (например, быстрые нажатия «+1»), подхватываются тем же циклом.
  const flushQueue = useCallback((): Promise<boolean> => {
    if (flushRef.current) {
      return flushRef.current;
    }
    if (queueRef.current.length === 0) {
      return Promise.resolve(true);
    }

    const run = (async () => {
      setSyncStatus("syncing");
      try {
        while (queueRef.current.length > 0) {
          const change = queueRef.current[0];

          if (change.action === "watch") {
            const record = await markFilmAsWatched(change.filmId, change.episodes);
            updateWatchedMap((current) => {
              const entry = current.get(change.filmId);
              if (!entry || entry.recordId === record.id) {
                return current;
              }
              const next = new Map(current);
              next.set(change.filmId, { ...entry, recordId: record.id });
              return next;
            });
          } else {
            const recordId = watchedMapRef.current.get(change.filmId)?.recordId;
            await unmarkFilmAsWatched(
              change.filmId,
              typeof recordId === "number" ? recordId : undefined,
            );
          }

          queueRef.current = queueRef.current.filter((item) => item !== change);
          saveQueue(queueRef.current);
        }

        setUsingLocal(false);
        setSyncStatus("synced");
        return true;
      } catch {
        setSyncStatus("offline");
        setUsingLocal(true);
        return false;
      } finally {
        flushRef.current = null;
      }
    })();

    flushRef.current = run;
    return run;
  }, [updateWatchedMap]);

  const refreshFromApi = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const records = await getWatchedFilms();
      applyRemoteWatched(records);

      if (queueRef.current.length > 0) {
        const flushed = await flushQueue();
        if (flushed) {
          const latest = await getWatchedFilms();
          applyRemoteWatched(latest);
        }
      } else {
        setUsingLocal(false);
        setSyncStatus("synced");
      }

      setLoadError(null);
    } catch {
      setUsingLocal(true);
      setSyncStatus("offline");
      setLoadError(
        "Не удалось подключиться к серверу. Используются локальные данные.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyRemoteWatched, flushQueue]);

  useEffect(() => {
    void refreshFromApi();
  }, [refreshFromApi]);

  useEffect(() => {
    const onOnline = () => {
      void refreshFromApi();
    };
    const onOffline = () => {
      setSyncStatus("offline");
      setUsingLocal(true);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshFromApi]);

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  useEffect(() => {
    saveCollapsed([...collapsed]);
  }, [collapsed]);

  const { watchedIds, episodesById } = useMemo(() => {
    const ids = new Set<string>();
    const episodes = new Map<string, number>();
    for (const [filmId, entry] of watchedMap) {
      const movie = movieById.get(filmId);
      if (!movie) {
        continue;
      }
      if (isFullyWatched(movie, entry)) {
        ids.add(filmId);
      }
      if (hasEpisodes(movie)) {
        episodes.set(filmId, getWatchedEpisodes(movie, entry));
      }
    }
    return { watchedIds: ids, episodesById: episodes as ReadonlyMap<string, number> };
  }, [watchedMap]);

  const commitChange = useCallback(
    (change: PendingChange) => {
      updateWatchedMap((current) => applyChangeToMap(current, change));
      queueRef.current = enqueueChange(queueRef.current, change);
      saveQueue(queueRef.current);
    },
    [updateWatchedMap],
  );

  const toggleWatched = useCallback(
    async (filmId: string) => {
      const movie = movieById.get(filmId);
      if (!movie || movie.future || pendingRef.current.has(filmId)) {
        return;
      }

      pendingRef.current.add(filmId);
      setPendingIds(new Set(pendingRef.current));

      const entry = watchedMapRef.current.get(filmId);
      const wasWatched = isFullyWatched(movie, entry);
      const previousEpisodes = hasEpisodes(movie)
        ? getWatchedEpisodes(movie, entry)
        : undefined;

      try {
        commitChange(
          wasWatched
            ? { filmId, action: "unwatch" }
            : {
                filmId,
                action: "watch",
                ...(hasEpisodes(movie) ? { episodes: movie.episodes } : {}),
              },
        );

        if (!navigator.onLine || syncStatus === "offline") {
          pushToast(
            "info",
            "Нет сети. Отметка сохранена только на этом устройстве.",
            { label: "Повторить", kind: "retry" },
          );
          return;
        }

        const saved = await flushQueue();
        if (saved) {
          pushToast(
            "success",
            wasWatched
              ? "Просмотр снят из общего списка."
              : "Отмечено в общем списке.",
            { label: "Отменить", kind: "undo", filmId, episodes: previousEpisodes },
          );
        } else {
          pushToast("error", "Не удалось сохранить в общий список.", {
            label: "Повторить",
            kind: "retry",
          });
        }
      } finally {
        pendingRef.current.delete(filmId);
        setPendingIds(new Set(pendingRef.current));
      }
    },
    [commitChange, flushQueue, pushToast, syncStatus],
  );

  const setEpisodes = useCallback(
    (filmId: string, count: number) => {
      const movie = movieById.get(filmId);
      if (!movie || movie.future || !hasEpisodes(movie) || !Number.isFinite(count)) {
        return;
      }

      const target = Math.min(Math.max(Math.trunc(count), 0), movie.episodes);
      const entry = watchedMapRef.current.get(filmId);
      if (getWatchedEpisodes(movie, entry) === target && Boolean(entry) === target > 0) {
        return;
      }

      commitChange(
        target === 0
          ? { filmId, action: "unwatch" }
          : { filmId, action: "watch", episodes: target },
      );

      // Серия нажатий «+1» отправляется на сервер одним запросом.
      window.clearTimeout(episodesTimerRef.current);
      episodesTimerRef.current = window.setTimeout(() => {
        if (!navigator.onLine) {
          pushToast(
            "info",
            "Нет сети. Прогресс сохранён только на этом устройстве.",
            { label: "Повторить", kind: "retry" },
          );
          return;
        }
        void flushQueue().then((saved) => {
          if (!saved) {
            pushToast("error", "Не удалось сохранить прогресс сериала.", {
              label: "Повторить",
              kind: "retry",
            });
          }
        });
      }, EPISODES_SYNC_DELAY_MS);
    },
    [commitChange, flushQueue, pushToast],
  );

  useEffect(() => () => window.clearTimeout(episodesTimerRef.current), []);
  const filteredMovies = useMemo(
    () =>
      movies.filter(
        (movie) =>
          matchesSearch(movie, query) &&
          matchesStatus(movie, filters.status, watchedIds) &&
          matchesImportance(movie, filters.importance) &&
          matchesCanon(movie, filters.canon) &&
          matchesType(movie, filters.type),
      ),
    [
      filters.canon,
      filters.importance,
      filters.status,
      filters.type,
      query,
      watchedIds,
    ],
  );

  const sections = useMemo(
    () => groupBySection(filteredMovies),
    [filteredMovies],
  );

  const allSections = useMemo(() => groupBySection(movies), []);
  const overall = useMemo(
    () => getProgress(movies, watchedIds),
    [watchedIds],
  );

  const selectedMovie = useMemo(
    () => movies.find((movie) => movie.id === selectedId) ?? null,
    [selectedId],
  );

  const filtersActive = hasActiveFilters(
    filters.status,
    filters.importance,
    filters.canon,
    filters.type,
    query,
  );

  const setStatus = useCallback((status: WatchStatusFilter) => {
    setFilters((current) => ({ ...current, status }));
  }, []);

  const setImportance = useCallback((importance: ImportanceFilter) => {
    setFilters((current) => ({ ...current, importance }));
  }, []);

  const setCanon = useCallback((canon: CanonFilter) => {
    setFilters((current) => ({ ...current, canon }));
  }, []);

  const setType = useCallback((type: TypeFilter) => {
    setFilters((current) => ({ ...current, type }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
  }, []);

  const toggleSection = useCallback((section: number) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsed(new Set(allSections.map((group) => group.section)));
  }, [allSections]);

  const expandAll = useCallback(() => {
    setCollapsed(new Set());
  }, []);

  return {
    movies,
    loading,
    loadError,
    usingLocal,
    syncStatus,
    watchedIds,
    pendingIds,
    episodesById,
    overall,
    sections,
    allSections,
    filteredCount: filteredMovies.length,
    totalCount: movies.length,
    filters,
    query,
    setQuery,
    setStatus,
    setImportance,
    setCanon,
    setType,
    resetFilters,
    filtersActive,
    collapsed,
    toggleSection,
    collapseAll,
    expandAll,
    toggleWatched,
    setEpisodes,
    selectedMovie,
    openDetails: setSelectedId,
    closeDetails: () => setSelectedId(null),
    toasts,
    dismissToast,
    applyToastAction: (toast: ToastMessage) => {
      if (toast.action?.kind === "undo" && toast.action.filmId) {
        if (toast.action.episodes !== undefined) {
          setEpisodes(toast.action.filmId, toast.action.episodes);
        } else {
          void toggleWatched(toast.action.filmId);
        }
        return;
      }
      if (toast.action?.kind === "retry") {
        void refreshFromApi();
      }
    },
    retrySync: refreshFromApi,
  };
}
