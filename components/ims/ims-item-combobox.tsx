"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { getImsCategoriesAction, searchImsItemsAction } from "@/app/actions/ims";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { ImsMasterItem } from "@/lib/types";

type ImsPick = Pick<ImsMasterItem, "id" | "item_code" | "item_category" | "item_description" | "make" | "model" | "unit" | "hsn_code" | "is_active">;

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

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
    getImsCategoriesAction().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);
      searchImsItemsAction({ category: category || undefined, search, limit: 12 })
        .then((result) => {
          setItems(result);
          setActiveIndex(0);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [category, search]);

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
      onSelect(item);
    onSearchChange(item.item_description);
    if (!category) onCategoryChange(item.item_category);
    setOpen(false);
  }

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropdownRef}
      id={listId}
      role="listbox"
      className="fixed max-h-[400px] overflow-y-auto overscroll-contain rounded-lg border border-border bg-white p-1 shadow-lift"
      style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 9999 }}
    >
      {items.length ? items.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            if (index === activeIndex) activeOptionRef.current = node;
          }}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={cn("flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-navy-50", index === activeIndex && "bg-navy-50")}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(item)}
        >
          <Check className={cn("mt-0.5 shrink-0 text-navy-700 opacity-0", index === activeIndex && "opacity-100")} size={15} />
          <span className="min-w-0">
            <span className="block break-words font-semibold text-navy-900">{highlightMatch(item.item_description, search)}</span>
            <span className="mt-0.5 block break-words text-xs text-slate-500">{highlightMatch([item.item_category, item.make, item.model, item.unit].filter(Boolean).join(" | "), search)}</span>
          </span>
        </button>
      )) : (
        <div className="px-3 py-4 text-sm text-slate-500">{loading ? "Searching IMS..." : "No active IMS items found."}</div>
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
              if (!items.length) return;
              updateDropdownPosition();
              setOpen(true);
              setActiveIndex((current) => Math.min(items.length - 1, current + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!items.length) return;
              setActiveIndex((current) => Math.max(0, current - 1));
            }
            if (event.key === "Enter" && open && items[activeIndex]) {
              event.preventDefault();
              choose(items[activeIndex]);
            }
            if (event.key === "Escape") setOpen(false);
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
  const needle = query.trim();
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-100 px-0.5 text-inherit">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}
