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
import { getProgress, groupBySection } from "../utils/progress";
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

let toastSeq = 1;

function enqueueChange(
  queue: PendingChange[],
  filmId: string,
  action: PendingChange["action"],
): PendingChange[] {
  const next = queue.filter((item) => item.filmId !== filmId);
  next.push({ filmId, action });
  return next;
}

export function useWatchlist() {
  const [watchedMap, setWatchedMap] = useState<Map<string, number | null>>(
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
  const syncingRef = useRef(false);
  const pendingRef = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    watchedMapRef.current = watchedMap;
    saveWatchedCache(cacheFromMap(watchedMap));
  }, [watchedMap]);

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

  const applyRemoteWatched = useCallback((records: { id: number; filmId: string }[]) => {
    const next = new Map<string, number | null>();
    for (const record of records) {
      if (!next.has(record.filmId)) {
        next.set(record.filmId, record.id);
      }
    }
    setWatchedMap(next);
    saveWatchedCache(cacheFromMap(next));
  }, []);

  const flushQueue = useCallback(async (): Promise<boolean> => {
    if (syncingRef.current || queueRef.current.length === 0) {
      return queueRef.current.length === 0;
    }

    syncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const pending = [...queueRef.current];
      for (const change of pending) {
        if (change.action === "watch") {
          const record = await markFilmAsWatched(change.filmId);
          setWatchedMap((current) => {
            const next = new Map(current);
            next.set(change.filmId, record.id);
            return next;
          });
        } else {
          const recordId = watchedMapRef.current.get(change.filmId);
          await unmarkFilmAsWatched(
            change.filmId,
            typeof recordId === "number" ? recordId : undefined,
          );
          setWatchedMap((current) => {
            const next = new Map(current);
            next.delete(change.filmId);
            return next;
          });
        }
        queueRef.current = queueRef.current.filter(
          (item) => item !== change && item.filmId !== change.filmId,
        );
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
      syncingRef.current = false;
    }
  }, []);

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

  const watchedIds = useMemo(
    () => new Set(watchedMap.keys()),
    [watchedMap],
  );

  const toggleWatched = useCallback(
    async (filmId: string) => {
      const movie = movies.find((item) => item.id === filmId);
      if (!movie || movie.future || pendingRef.current.has(filmId)) {
        return;
      }

      pendingRef.current.add(filmId);
      setPendingIds(new Set(pendingRef.current));

      const wasWatched = watchedMapRef.current.has(filmId);
      const previous = new Map(watchedMapRef.current);

      try {
        setWatchedMap((current) => {
          const next = new Map(current);
          if (wasWatched) {
            next.delete(filmId);
          } else {
            next.set(filmId, current.get(filmId) ?? null);
          }
          return next;
        });

        const action = wasWatched ? "unwatch" : "watch";

        if (!navigator.onLine || syncStatus === "offline") {
          queueRef.current = enqueueChange(queueRef.current, filmId, action);
          saveQueue(queueRef.current);
          pushToast(
            "info",
            "Нет сети. Отметка сохранена только на этом устройстве.",
            { label: "Повторить", kind: "retry" },
          );
          return;
        }

        setSyncStatus("syncing");
        try {
          if (wasWatched) {
            const recordId = previous.get(filmId);
            await unmarkFilmAsWatched(
              filmId,
              typeof recordId === "number" ? recordId : undefined,
            );
            setWatchedMap((current) => {
              const next = new Map(current);
              next.delete(filmId);
              return next;
            });
          } else {
            const record = await markFilmAsWatched(filmId);
            setWatchedMap((current) => {
              const next = new Map(current);
              next.set(filmId, record.id);
              return next;
            });
          }
          setSyncStatus("synced");
          setUsingLocal(false);
          pushToast(
            "success",
            wasWatched
              ? "Просмотр снят из общего списка."
              : "Отмечено в общем списке.",
            { label: "Отменить", kind: "undo", filmId },
          );
        } catch {
          setWatchedMap(previous);
          queueRef.current = enqueueChange(queueRef.current, filmId, action);
          saveQueue(queueRef.current);
          setSyncStatus("offline");
          setUsingLocal(true);
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
    [pushToast, syncStatus],
  );

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
    watchedMap,
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
    selectedMovie,
    openDetails: setSelectedId,
    closeDetails: () => setSelectedId(null),
    toasts,
    dismissToast,
    applyToastAction: (toast: ToastMessage) => {
      if (toast.action?.kind === "undo" && toast.action.filmId) {
        void toggleWatched(toast.action.filmId);
        return;
      }
      if (toast.action?.kind === "retry") {
        void refreshFromApi();
      }
    },
    retrySync: refreshFromApi,
  };
}
