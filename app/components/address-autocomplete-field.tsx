"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  searchAddressSuggestions,
  type AddressSuggestion,
} from "@/lib/address-autocomplete";
import type { ServiceLocation } from "@/lib/service-location";

type AddressAutocompleteFieldProps = {
  location: ServiceLocation;
  onLocationChange: (location: ServiceLocation) => void;
};

export function AddressAutocompleteField({
  location,
  onLocationChange,
}: AddressAutocompleteFieldProps) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const query = location.address.trim();
    if (!isAddressFocused || query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      void searchAddressSuggestions(query, { signal: controller.signal })
        .then((results) => {
          setSuggestions(results);
          setIsOpen(results.length > 0);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setIsOpen(false);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isAddressFocused, location.address]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddressFocused(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const applySuggestion = (suggestion: AddressSuggestion) => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    onLocationChange({
      address: suggestion.address || location.address,
      city: suggestion.city || location.city,
      zipCode: suggestion.zipCode || location.zipCode,
    });
    setIsOpen(false);
    setIsAddressFocused(false);
    setSuggestions([]);
  };

  const showDropdown =
    isAddressFocused && (isSearching || (isOpen && suggestions.length > 0));

  return (
    <div className="casker-filter-location-fields">
      <div ref={wrapperRef} className="casker-filter-field-group">
        <label htmlFor="service-location-address" className="casker-filter-field-label">
          Adresa
        </label>
        <input
          id="service-location-address"
          type="text"
          className="casker-filter-field"
          value={location.address}
          placeholder="Napr. Mudroňová 31"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={showDropdown ? listId : undefined}
          aria-autocomplete="list"
          onChange={(event) =>
            onLocationChange({
              ...location,
              address: event.target.value,
            })
          }
          onFocus={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
            setIsAddressFocused(true);
          }}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => {
              setIsAddressFocused(false);
              setIsOpen(false);
              blurTimeoutRef.current = null;
            }, 150);
          }}
        />
        {showDropdown ? (
          <div id={listId} className="casker-address-dropdown" role="listbox">
            {isSearching && suggestions.length === 0 ? (
              <p className="casker-address-dropdown-status">Hľadám adresy…</p>
            ) : null}
            <ul className="casker-address-dropdown-list">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id} role="option">
                  <button
                    type="button"
                    className="casker-address-dropdown-item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applySuggestion(suggestion)}
                  >
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="casker-filter-location-row">
        <div className="casker-filter-field-group casker-filter-field-group--compact">
          <label htmlFor="service-location-city" className="casker-filter-field-label">
            Mesto
          </label>
          <input
            id="service-location-city"
            type="text"
            className="casker-filter-field casker-filter-field--compact"
            value={location.city}
            placeholder="Žilina"
            onChange={(event) =>
              onLocationChange({
                ...location,
                city: event.target.value,
              })
            }
          />
        </div>

        <div className="casker-filter-field-group casker-filter-field-group--compact">
          <label htmlFor="service-location-zip" className="casker-filter-field-label">
            PSČ
          </label>
          <input
            id="service-location-zip"
            type="text"
            className="casker-filter-field casker-filter-field--compact"
            value={location.zipCode}
            placeholder="010 01"
            inputMode="numeric"
            onChange={(event) =>
              onLocationChange({
                ...location,
                zipCode: event.target.value,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
