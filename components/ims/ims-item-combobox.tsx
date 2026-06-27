"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Loader2, Search, Star } from "lucide-react";
import { getImsCategoriesAction, searchImsItemsAction } from "@/app/actions/ims";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { ImsMasterItem } from "@/lib/types";

type ImsPick = Pick<ImsMasterItem, "id" | "item_code" | "item_category" | "item_description" | "make" | "model" | "unit" | "hsn_code" | "is_active">;
const recentProductsKey = "adhunik-ims-recent-products";
const favoriteProductsKey = "adhunik-ims-favorite-products";
const maxRecentProducts = 30;

export function ImsItemCombobox({
  category,
  search,
  onCategoryChange,
  onSearchChange,
  onSelect
}: {
  category?: string | null;
  search: string;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSelect: (item: ImsPick) => void;
}) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ImsPick[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [recentItems, setRecentItems] = useState<ImsPick[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const searchCacheRef = useRef(new Map<string, ImsPick[]>());

  const updateDropdownPosition = useCallback(() => {
    const rect = inputWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportPadding = 12;
    const availableWidth = Math.max(240, window.innerWidth - viewportPadding * 2);
    const width = Math.min(rect.width, availableWidth);
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
    setDropdownRect({ top: rect.bottom + 8, left, width });
  }, []);

  useEffect(() => {
    setMounted(true);
    setRecentItems(readStoredProducts(recentProductsKey));
    setFavoriteIds(readStoredIds(favoriteProductsKey));
    getImsCategoriesAction().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const cacheKey = `${category || ""}::${search.trim().toLowerCase()}`;
      if (!search.trim()) {
        setItems(sortRecentProducts(recentItems, favoriteIds));
        setActiveIndex(0);
        setLoading(false);
        return;
      }
      const cached = searchCacheRef.current.get(cacheKey);
      if (cached) {
        setItems(cached);
        setActiveIndex(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      searchImsItemsAction({ category: category || undefined, search, limit: 25 })
        .then((result) => {
          searchCacheRef.current.set(cacheKey, result);
          setItems(result);
          setActiveIndex(0);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [category, favoriteIds, recentItems, search]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
  }, [open, items.length, search, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function choose(item: ImsPick) {
    const nextRecent = [item, ...recentItems.filter((recent) => recent.id !== item.id)].slice(0, maxRecentProducts);
    setRecentItems(nextRecent);
    writeStoredProducts(recentProductsKey, nextRecent);
    onSelect(item);
    onSearchChange(item.item_description);
    if (!category) onCategoryChange(item.item_category);
    setOpen(false);
  }

  function toggleFavorite(item: ImsPick) {
    setFavoriteIds((current) => {
      const next = current.includes(item.id) ? current.filter((id) => id !== item.id) : [item.id, ...current];
      writeStoredIds(favoriteProductsKey, next);
      return next;
    });
  }

  const showRecent = !search.trim();
  const visibleItems = showRecent ? sortRecentProducts(recentItems, favoriteIds) : items;

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropdownRef}
      id={listId}
      role="listbox"
      className="fixed max-h-[400px] overflow-y-auto overscroll-contain rounded-lg border border-border bg-white p-1 shadow-lift"
      style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 9999 }}
    >
      {showRecent && visibleItems.length ? <div className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Recently Used Products</div> : null}
      {visibleItems.length ? visibleItems.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            if (index === activeIndex) activeOptionRef.current = node;
          }}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={cn("flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-navy-50", index === activeIndex && "bg-navy-50")}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(item)}
        >
          <Check className={cn("mt-0.5 shrink-0 text-navy-700 opacity-0", index === activeIndex && "opacity-100")} size={15} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              {item.item_code ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">{highlightMatch(item.item_code, search)}</span> : null}
              <span className="break-words font-semibold text-navy-900">{highlightMatch(item.item_description, search)}</span>
            </span>
            <span className="mt-1 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
              <span>Category: <strong className="text-slate-700">{highlightMatch(item.item_category, search)}</strong></span>
              <span>Make: <strong className="text-slate-700">{highlightMatch(item.make || "-", search)}</strong></span>
              <span>Model: <strong className="text-slate-700">{highlightMatch(item.model || "-", search)}</strong></span>
              <span>Unit: <strong className="text-slate-700">{item.unit || "-"}</strong></span>
            </span>
          </span>
          <span
            role="button"
            tabIndex={-1}
            title={favoriteIds.includes(item.id) ? "Remove favorite" : "Add favorite"}
            className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-transparent text-slate-300 hover:border-amber-100 hover:bg-amber-50 hover:text-amber-500", favoriteIds.includes(item.id) && "text-amber-500")}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleFavorite(item);
            }}
          >
            <Star size={15} fill={favoriteIds.includes(item.id) ? "currentColor" : "none"} />
          </span>
        </button>
      )) : (
        <div className="px-3 py-4 text-sm text-slate-500">{loading ? "Searching IMS..." : showRecent ? "No recently used products yet." : "No active IMS items found."}</div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={wrapperRef} className="grid gap-2 md:grid-cols-[13rem_minmax(18rem,1fr)]">
      <select className={inputClass} value={category ?? ""} onChange={(event) => onCategoryChange(event.target.value)}>
        <option value="">All Categories</option>
        {categories.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <div ref={inputWrapperRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
        <input
          className={`${inputClass} w-full pl-9 pr-10`}
          value={search}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          placeholder="Search IMS item"
          onFocus={() => {
            updateDropdownPosition();
            setOpen(true);
          }}
          onChange={(event) => {
            onSearchChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!visibleItems.length) return;
              updateDropdownPosition();
              setOpen(true);
              setActiveIndex((current) => Math.min(visibleItems.length - 1, current + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!visibleItems.length) return;
              setActiveIndex((current) => Math.max(0, current - 1));
            }
            if (event.key === "Enter" && open && visibleItems[activeIndex]) {
              event.preventDefault();
              choose(visibleItems[activeIndex]);
            }
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Tab") setOpen(false);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          className="absolute right-0 top-0 h-10 w-10 px-0"
          onClick={() => {
            updateDropdownPosition();
            setOpen((value) => !value);
          }}
          aria-label="Toggle IMS results"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <ChevronsUpDown size={15} />}
        </Button>
        {dropdown}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const needles = tokenizeHighlight(query);
  if (!needles.length) return text;
  const lower = text.toLowerCase();
  const matches = needles
    .map((needle) => ({ start: lower.indexOf(needle), length: needle.length }))
    .filter((match) => match.start >= 0)
    .sort((a, b) => a.start - b.start);
  const first = matches[0];
  if (!first) return text;

  return (
    <>
      {text.slice(0, first.start)}
      <mark className="rounded bg-amber-100 px-0.5 text-inherit">{text.slice(first.start, first.start + first.length)}</mark>
      {text.slice(first.start + first.length)}
    </>
  );
}

function tokenizeHighlight(value: string) {
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? [])).sort((a, b) => b.length - a.length);
}

function readStoredProducts(key: string): ImsPick[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isStoredProduct).slice(0, maxRecentProducts) : [];
  } catch {
    return [];
  }
}

function writeStoredProducts(key: string, value: ImsPick[]) {
  window.localStorage.setItem(key, JSON.stringify(value.slice(0, maxRecentProducts)));
}

function readStoredIds(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, value: string[]) {
  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(value)).slice(0, 50)));
}

function isStoredProduct(value: unknown): value is ImsPick {
  return Boolean(value && typeof value === "object" && "id" in value && "item_description" in value && "item_category" in value);
}

function sortRecentProducts(items: ImsPick[], favoriteIds: string[]) {
  return [...items].sort((a, b) => Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id)));
}
