import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  "aria-describedby"?: string;
}

const LIST_MAX_HEIGHT = 288;
const LIST_GAP = 6;
const VIEWPORT_MARGIN = 12;
const OPTION_HEIGHT = 40;

const supportsPopover =
  typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

/**
 * Выпадающий список в стиле сайта. Список открывается в верхнем слое (popover),
 * поэтому его не обрезают ни рамка диалога, ни прокрутка формы.
 */
export function Select({
  id,
  value,
  options,
  onChange,
  "aria-describedby": describedBy,
}: SelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeaheadRef = useRef({ text: "", timer: 0 });

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<CSSProperties>({});

  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const selected = options[selectedIndex];

  const close = useCallback(() => setOpen(false), []);

  const openList = useCallback(() => {
    setActive(selectedIndex);
    setOpen(true);
  }, [selectedIndex]);

  const choose = (index: number) => {
    const option = options[index];
    if (option) {
      onChange(option.value);
    }
    close();
    triggerRef.current?.focus();
  };

  // Позиция под полем или над ним, если снизу не хватает места.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!open || !trigger || !list) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - LIST_GAP - VIEWPORT_MARGIN;
    const above = rect.top - LIST_GAP - VIEWPORT_MARGIN;
    const needed = Math.min(options.length * OPTION_HEIGHT + 12, LIST_MAX_HEIGHT);
    const openBelow = below >= needed || below >= above;
    const maxHeight = Math.max(Math.min(LIST_MAX_HEIGHT, openBelow ? below : above), 96);

    setPlacement(
      openBelow
        ? { top: rect.bottom + LIST_GAP, left: rect.left, width: rect.width, maxHeight }
        : {
            bottom: window.innerHeight - rect.top + LIST_GAP,
            left: rect.left,
            width: rect.width,
            maxHeight,
          },
    );

    if (supportsPopover && !list.matches(":popover-open")) {
      list.showPopover();
    }
    return () => {
      if (supportsPopover && list.matches(":popover-open")) {
        list.hidePopover();
      }
    };
  }, [open, options.length]);

  // Закрытие по клику снаружи, прокрутке и изменению размеров окна.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !listRef.current?.contains(target)) {
        close();
      }
    };
    const onScroll = (event: Event) => {
      if (!listRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) {
      return;
    }
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    const typeahead = typeaheadRef.current;
    return () => window.clearTimeout(typeahead.timer);
  }, []);

  const moveActive = (index: number) =>
    setActive(Math.min(Math.max(index, 0), options.length - 1));

  const findByTyping = (key: string): number => {
    const typeahead = typeaheadRef.current;
    window.clearTimeout(typeahead.timer);
    typeahead.text += key.toLowerCase();
    typeahead.timer = window.setTimeout(() => {
      typeahead.text = "";
    }, 600);
    const from = open ? active : selectedIndex;
    const order = [...options.keys()];
    const rotated = [...order.slice(from + 1), ...order.slice(0, from + 1)];
    const match = rotated.find((index) =>
      options[index].label
        .toLowerCase()
        .replace(/^[\d.\s]+/, "")
        .startsWith(typeahead.text),
    );
    return match ?? -1;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          openList();
          return;
        }
        moveActive(active + (event.key === "ArrowDown" ? 1 : -1));
        return;
      }
      case "Home":
      case "End": {
        if (open) {
          event.preventDefault();
          moveActive(event.key === "Home" ? 0 : options.length - 1);
        }
        return;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        if (open) {
          choose(active);
        } else {
          openList();
        }
        return;
      }
      case "Escape": {
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        return;
      }
      case "Tab": {
        close();
        return;
      }
      default: {
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const index = findByTyping(event.key);
          if (index >= 0) {
            if (open) {
              setActive(index);
            } else {
              onChange(options[index].value);
            }
          }
        }
      }
    }
  };

  return (
    <div className="select">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="field-input select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        data-open={open ? "" : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{selected?.label}</span>
        <svg className="select-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <ul
        ref={listRef}
        id={listId}
        className="select-list"
        role="listbox"
        popover={supportsPopover ? "manual" : undefined}
        data-open={open ? "" : undefined}
        style={placement}
        // Клик по списку не должен уводить фокус с поля.
        onPointerDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => (
          <li
            key={option.value}
            id={`${listId}-${index}`}
            className="select-option"
            role="option"
            aria-selected={index === selectedIndex}
            data-index={index}
            data-active={index === active ? "" : undefined}
            onPointerMove={() => index !== active && setActive(index)}
            onClick={() => choose(index)}
          >
            <span className="select-option-label">{option.label}</span>
            <svg className="select-check" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </li>
        ))}
      </ul>
    </div>
  );
}
