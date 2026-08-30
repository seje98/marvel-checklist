interface SearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function Search({ value, onChange }: SearchProps) {
  return (
    <div className="search-wrap">
      <div className="search-core">
        <label className="sr-only" htmlFor="watchlist-search">
          Поиск по названию
        </label>
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.25" />
          <path
            d="M16.2 16.2L21 21"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
        <input
          id="watchlist-search"
          className="search-input"
          type="search"
          name="watchlist-search"
          placeholder="Поиск: Железный человек"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
      </div>
    </div>
  );
}
