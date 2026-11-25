import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from "react";

type Props = Omit<ComponentPropsWithoutRef<"input">, "id" | "list" | "value" | "onChange"> & {
  label: string;
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

function searchKey(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim();
}

export default function SuggestionField({ label, suggestions, value, onChange, error, onBlur, onClick, onFocus, onKeyDown, disabled, ...props }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const query = searchKey(value);
  const selected = suggestions.find(option => searchKey(option) === query);
  const options = selected ? suggestions : suggestions.filter(option => searchKey(option).includes(query));
  const expanded = open && !disabled;
  const active = expanded && highlight >= 0 && highlight < options.length ? highlight : -1;

  useEffect(() => {
    if (active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function close() {
    setOpen(false);
    setHighlight(-1);
  }

  function choose(option: string) {
    onChange(option);
    close();
  }

  return (
    <div className="field suggestion-field" data-open={expanded}>
      <label htmlFor={id}>{label}</label>
      <div className="suggestion-control">
        <input
          {...props}
          ref={input}
          id={id}
          value={value}
          disabled={disabled}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={id + "-options"}
          aria-activedescendant={active >= 0 ? id + "-option-" + active : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? id + "-error" : undefined}
          onClick={event => {
            setOpen(true);
            onClick?.(event);
          }}
          onFocus={event => {
            setOpen(true);
            onFocus?.(event);
          }}
          onBlur={event => {
            close();
            onBlur?.(event);
          }}
          onChange={event => {
            onChange(event.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onKeyDown={event => {
            onKeyDown?.(event);
            if (event.defaultPrevented || event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (!options.length) return;
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setHighlight(active < 0 ? direction > 0 ? 0 : options.length - 1 : (active + direction + options.length) % options.length);
            } else if (event.key === "Escape" && expanded) {
              event.preventDefault();
              close();
            } else if (event.key === "Enter" && active >= 0) {
              event.preventDefault();
              choose(options[active]);
            }
          }}
        />
        <button type="button" tabIndex={-1} className="suggestion-toggle" disabled={disabled}
          aria-label={expanded ? "Cerrar opciones" : "Mostrar opciones"}
          onMouseDown={event => event.preventDefault()}
          onClick={() => {
            if (expanded) close();
            else {
              input.current?.focus();
              setOpen(true);
            }
          }}>
          <ChevronDownIcon aria-hidden="true" />
        </button>
        <div className="suggestion-menu" hidden={!expanded}>
          <ul id={id + "-options"} ref={list} role="listbox" aria-label={label}>
            {expanded && options.map((option, index) => (
              <li key={option} id={id + "-option-" + index} role="option" aria-selected={index === active || active < 0 && option === selected}
                data-active={index === active}
                onMouseDown={event => event.preventDefault()}
                onClick={() => choose(option)}>
                <span>{option}</span>
                {option === selected && <CheckIcon aria-hidden="true" />}
              </li>
            ))}
          </ul>
          {expanded && !options.length && <p role="status">No hay coincidencias.</p>}
        </div>
      </div>
      {error && <small id={id + "-error"} className="field-error">{error}</small>}
    </div>
  );
}
