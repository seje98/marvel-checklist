import { useEffect } from "react";
import { useMovies } from "./hooks/useMovies";
import { useRealtime } from "./hooks/useRealtime";
import { useRoute } from "./hooks/useRoute";
import { useWatchlist } from "./hooks/useWatchlist";
import { ListEditorPage } from "./pages/ListEditorPage";
import { WatchlistPage } from "./pages/WatchlistPage";

export default function App() {
  const route = useRoute();
  const moviesState = useMovies();
  const watchlist = useWatchlist(moviesState.movies, moviesState.movieById);

  useRealtime({
    watched: watchlist.retrySync,
    movies: moviesState.refresh,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);

  if (route === "list") {
    return <ListEditorPage moviesState={moviesState} />;
  }

  return <WatchlistPage watchlist={watchlist} moviesState={moviesState} />;
}
