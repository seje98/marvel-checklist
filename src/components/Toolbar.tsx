interface ToolbarProps {
  filtersActive: boolean;
  onReset: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  visibleCount: number;
  totalCount: number;
}

export function Toolbar({
  filtersActive,
  onReset,
  onCollapseAll,
  onExpandAll,
  visibleCount,
  totalCount,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <p className="toolbar-count">
        Показано {visibleCount}&nbsp;из&nbsp;{totalCount}
      </p>
      <div className="toolbar-actions">
        {visibleCount > 0 ? (
          <>
            <button type="button" className="ghost-btn" onClick={onCollapseAll}>
              Свернуть все части
            </button>
            <button type="button" className="ghost-btn" onClick={onExpandAll}>
              Развернуть все части
            </button>
          </>
        ) : null}
        {filtersActive ? (
          <button type="button" className="ghost-btn" onClick={onReset}>
            Сбросить фильтры
          </button>
        ) : null}
      </div>
    </div>
  );
}
