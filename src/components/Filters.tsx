import { useEffect, useState } from "react";
import type {
  CanonFilter,
  ImportanceFilter,
  TypeFilter,
  WatchStatusFilter,
} from "../types/movie";
import { TYPE_LABELS } from "../utils/labels";

interface ChipOption<T extends string> {
  value: T;
  label: string;
  tone?: "required" | "recommended" | "optional" | "multiverse" | "legacy";
}

const STATUS_OPTIONS: ChipOption<WatchStatusFilter>[] = [
  { value: "all", label: "Все статусы" },
  { value: "unwatched", label: "Не просмотрено" },
  { value: "watched", label: "Просмотрено" },
];

const IMPORTANCE_OPTIONS: ChipOption<ImportanceFilter>[] = [
  { value: "all", label: "Любая" },
  { value: "required", label: "Обязательно", tone: "required" },
  { value: "recommended", label: "Желательно", tone: "recommended" },
  { value: "optional", label: "Необязательно", tone: "optional" },
];

const CANON_OPTIONS: ChipOption<CanonFilter>[] = [
  { value: "all", label: "Любой" },
  { value: "multiverse", label: "Мультивселенная", tone: "multiverse" },
  { value: "legacy", label: "TV / Legacy", tone: "legacy" },
];

const TYPE_OPTIONS: ChipOption<TypeFilter>[] = [
  { value: "all", label: "Все типы" },
  { value: "movie", label: "Фильмы" },
  { value: "series", label: "Сериалы" },
  { value: "one-shot", label: "One-Shot" },
  { value: "special", label: "Спецвыпуск" },
  { value: "animation", label: "Анимация" },
  { value: "legacy", label: "Legacy" },
];

interface FilterGroupProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: ChipOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
}

function FilterGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  hint,
}: FilterGroupProps<T>) {
  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      {hint ? <p className="filter-hint">{hint}</p> : null}
      <div className="chip-row">
        {options.map((option) => (
          <label
            key={option.value}
            className={[
              "chip",
              value === option.value ? "chip-active" : "",
              option.tone ? `chip-tone-${option.tone}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              autoComplete="off"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface FiltersProps {
  status: WatchStatusFilter;
  importance: ImportanceFilter;
  canon: CanonFilter;
  type: TypeFilter;
  onStatus: (value: WatchStatusFilter) => void;
  onImportance: (value: ImportanceFilter) => void;
  onCanon: (value: CanonFilter) => void;
  onType: (value: TypeFilter) => void;
}

export function Filters({
  status,
  importance,
  canon,
  type,
  onStatus,
  onImportance,
  onCanon,
  onType,
}: FiltersProps) {
  const forcedOpen = canon !== "all" || type !== "all";
  const [moreOpen, setMoreOpen] = useState(forcedOpen);

  useEffect(() => {
    if (forcedOpen) {
      setMoreOpen(true);
    }
  }, [forcedOpen]);

  const typeSummary =
    type === "all" ? "Тип" : `Тип: ${type === "one-shot" ? "One-Shot" : TYPE_LABELS[type]}`;
  const moreLabel = [
    canon !== "all"
      ? CANON_OPTIONS.find((option) => option.value === canon)?.label
      : null,
    type !== "all" ? typeSummary : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="filters">
      <FilterGroup
        legend="Путь просмотра"
        name="filter-importance"
        value={importance}
        options={IMPORTANCE_OPTIONS}
        onChange={onImportance}
        hint="Обязательно — сюжет. Остальное можно пропустить."
      />
      <FilterGroup
        legend="Статус"
        name="filter-status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={onStatus}
      />
      <details
        className="filter-more"
        open={moreOpen}
        onToggle={(event) => {
          const next = event.currentTarget.open;
          setMoreOpen(next);
          if (!next && forcedOpen) {
            onCanon("all");
            onType("all");
          }
        }}
      >
        <summary>{moreLabel || "Ещё: канон и тип"}</summary>
        <div className="filter-more-body" hidden={!moreOpen}>
          <FilterGroup
            legend="Канон"
            name="filter-canon"
            value={canon}
            options={CANON_OPTIONS}
            onChange={onCanon}
          />
          <FilterGroup
            legend="Тип"
            name="filter-type"
            value={type}
            options={TYPE_OPTIONS}
            onChange={onType}
          />
        </div>
      </details>
    </div>
  );
}
