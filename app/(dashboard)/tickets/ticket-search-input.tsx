"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_BADGE } from "./ticket-badges";
import type { TicketStatus } from "@/app/generated/prisma/client";

type Suggestion = { id: string; ticketNumber: string; title: string; status: TicketStatus };

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

// Sits inside the existing `<form method="get">` filter bar — the `q` input
// still submits/filters normally on Enter/"Filter" click, this just layers
// a debounced autocomplete dropdown on top (by title or ticket number) that
// jumps straight to a specific ticket when one is picked.
export function TicketSearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = next.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickets/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        if (!res.ok || requestId !== requestIdRef.current) return;
        const data = (await res.json()) as Suggestion[];
        if (requestId !== requestIdRef.current) return;
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        // Network hiccup — the plain substring filter still works on submit.
      }
    }, DEBOUNCE_MS);
  }

  function selectSuggestion(id: string) {
    setOpen(false);
    router.push(`/tickets/${id}`);
  }

  return (
    <div className="position-relative flex-grow-1" ref={containerRef}>
      <div className="input-group input-group-sm">
        <span className="input-group-text">
          <i className="bi bi-search" aria-hidden="true"></i>
        </span>
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(suggestions.length > 0)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="form-control form-control-sm"
          placeholder="Search tickets"
          aria-label="Search tickets"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="ticket-search-suggestions"
          aria-autocomplete="list"
        />
      </div>
      {open && (
        <ul
          id="ticket-search-suggestions"
          role="listbox"
          className="list-group position-absolute w-100 shadow-sm"
          style={{ zIndex: 1050, top: "100%" }}
        >
          {suggestions.map((s) => (
            <li key={s.id} role="option" aria-selected="false" className="list-group-item p-0">
              <button
                type="button"
                className="btn btn-link text-decoration-none text-reset d-flex align-items-center justify-content-between gap-2 w-100 text-start px-3 py-2"
                onClick={() => selectSuggestion(s.id)}
              >
                <span className="text-truncate">
                  <span className="fw-medium">{s.ticketNumber}</span>
                  <span className="text-secondary"> — {s.title}</span>
                </span>
                <span className={`badge ${STATUS_BADGE[s.status]} flex-shrink-0`}>{s.status}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
