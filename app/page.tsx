"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Car,
  Check,
  Clock,
  Filter,
  KeyRound,
  MapPin,
  MessageCircle,
  Phone,
  User,
} from "lucide-react";

type DashboardState = "inquiry" | "waiting" | "done";

type Request = {
  id: string;
  status: DashboardState;
  vehicleName: string;
  service: string;
  licensePlate: string;
  distanceKm: string;
  vin: string;
  engineVolume: string;
  power: string;
  fuelType: string;
  year: number;
  userName: string;
  phone: string;
};

const REQUESTS: Request[] = [
  {
    id: "1",
    status: "inquiry",
    vehicleName: "Škoda Octavia",
    service: "Výmena oleja + filtrov",
    licensePlate: "AA970VG",
    distanceKm: "13,4",
    vin: "TMBBS21Z802123456",
    engineVolume: "1.9 l",
    power: "77 kW",
    fuelType: "Nafta",
    year: 2004,
    userName: "Ján Novák",
    phone: "+421 905 123 456",
  },
  {
    id: "2",
    status: "waiting",
    vehicleName: "VW Golf",
    service: "Diagnostika motora",
    licensePlate: "ZA123AB",
    distanceKm: "8,2",
    vin: "WVWZZZ1KZ6W386752",
    engineVolume: "1.4 l",
    power: "90 kW",
    fuelType: "Benzín",
    year: 2016,
    userName: "Mária Kováčová",
    phone: "+421 911 987 654",
  },
  {
    id: "3",
    status: "done",
    vehicleName: "Ford Focus",
    service: "Výmena brzdových doštičiek",
    licensePlate: "BL456CD",
    distanceKm: "21,7",
    vin: "WF0AXXWPMA1234567",
    engineVolume: "1.6 l",
    power: "85 kW",
    fuelType: "Benzín",
    year: 2012,
    userName: "Peter Horváth",
    phone: "+421 948 222 333",
  },
];

function InquiryIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex flex-col items-center justify-center leading-none ${className ?? ""}`}
      aria-hidden
    >
      <KeyRound className="-mb-px h-3 w-3" strokeWidth={2.5} />
      <Car className="h-4 w-4" strokeWidth={2.25} />
    </span>
  );
}

const STATE_CONFIG: Record<
  DashboardState,
  { label: string; Icon: LucideIcon | typeof InquiryIcon }
> = {
  inquiry: { label: "Dopyt", Icon: InquiryIcon },
  waiting: { label: "Čaká", Icon: Clock },
  done: { label: "Prijaté", Icon: Check },
};

const STATE_ORDER: DashboardState[] = ["inquiry", "waiting", "done"];

const MAP_BACKGROUND =
  "linear-gradient(135deg, #d4e8d4 0%, #b8d4e8 50%, #a8c8dc 100%)";

const MAP_GRID_BACKGROUND = `
  linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px),
  linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)
`;

const VEHICLE_FIELDS: { key: keyof Request; label: string }[] = [
  { key: "vin", label: "VIN kód" },
  { key: "engineVolume", label: "Objem motora" },
  { key: "power", label: "Výkon" },
  { key: "fuelType", label: "Druh paliva" },
  { key: "vehicleName", label: "Názov vozidla" },
  { key: "year", label: "Rok výroby" },
];

function RequestDetailPanel({ request }: { request: Request }) {
  return (
    <div className="casker-detail-panel">
      <div className="casker-detail-vehicle">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Informácie o vozidle
        </h3>
        <p className="mb-4 text-xs text-zinc-600">{request.service}</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {VEHICLE_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-xs font-medium text-zinc-500">{label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-zinc-900">
                {key === "year"
                  ? request.year
                  : String(request[key as keyof Request])}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="casker-detail-contact">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Kontakt
        </h3>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B194F]/10 text-[#0B194F]">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">Používateľ</p>
            <p className="truncate text-sm font-semibold text-zinc-900">
              {request.userName}
            </p>
          </div>
        </div>
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B194F]/10 text-[#0B194F]">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">Telefón</p>
            <a
              href={`tel:${request.phone.replace(/\s/g, "")}`}
              className="text-sm font-semibold text-[#0B194F] hover:underline"
            >
              {request.phone}
            </a>
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-lg bg-[#0B194F] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0d2060]"
          >
            Odpovedať na dopyt
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0B194F] bg-white px-3 py-2.5 text-sm font-semibold text-[#0B194F] transition-colors hover:bg-[#0B194F]/5"
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeState, setActiveState] = useState<DashboardState>("inquiry");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );

  const { label: sectionLabel } = STATE_CONFIG[activeState];

  const filteredRequests = useMemo(
    () => REQUESTS.filter((r) => r.status === activeState),
    [activeState],
  );

  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    const request = REQUESTS.find((r) => r.id === selectedRequestId);
    if (!request || request.status !== activeState) return null;
    return request;
  }, [selectedRequestId, activeState]);

  const handleSelectRequest = (id: string) => {
    setSelectedRequestId(id);
  };

  const handleStateChange = (state: DashboardState) => {
    setActiveState(state);
    setSelectedRequestId(null);
  };

  return (
    <div className="casker-dashboard font-sans">
      <aside className="casker-sidebar">
        <header className="relative flex shrink-0 items-center justify-center bg-[#0B194F] px-3">
          <h1 className="text-lg font-bold tracking-wide text-white">cAsker</h1>
          <button
            type="button"
            aria-label="Filter"
            className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Filter className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </header>

        <div className="casker-sidebar-scroll">
          <div className="casker-state-switcher">
            {STATE_ORDER.map((state) => {
              const { Icon } = STATE_CONFIG[state];
              const isActive = activeState === state;

              return (
                <button
                  key={state}
                  type="button"
                  className="casker-state-btn"
                  onClick={() => handleStateChange(state)}
                  aria-label={STATE_CONFIG[state].label}
                  aria-pressed={isActive}
                >
                  <span
                    className={`casker-state-btn-inner ${isActive ? "is-active" : "is-inactive"}`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.25} />
                  </span>
                </button>
              );
            })}
          </div>

          <h2 className="pb-3 text-center text-xl font-bold text-zinc-900">
            {sectionLabel}
          </h2>

          <div className="casker-request-list">
            {filteredRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                Žiadne dopyty v tejto kategórii
              </p>
            ) : (
              filteredRequests.map((request) => {
                const isSelected = selectedRequestId === request.id;

                return (
                  <button
                    key={request.id}
                    type="button"
                    className={`casker-request-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleSelectRequest(request.id)}
                    aria-pressed={isSelected}
                  >
                    <div className="flex w-full items-start gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B194F]/10 text-[#0B194F]">
                        <Car className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <h3 className="text-base font-bold leading-tight text-zinc-900">
                          {request.vehicleName} {request.year}
                        </h3>
                        <p className="mt-0.5 text-xs leading-snug text-zinc-600">
                          {request.service}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="rounded bg-zinc-200/90 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                        EČ - {request.licensePlate}
                      </span>
                      <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-700">
                        <MapPin className="h-3.5 w-3.5 text-[#0B194F]" />
                        <span>{request.distanceKm} km</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <footer className="casker-sidebar-footer">
          <span className="text-sm font-medium text-gray-600">
            Názov servisu
          </span>
          <div
            className="h-8 w-8 shrink-0 rounded border border-gray-300 bg-gray-200"
            aria-hidden
          />
        </footer>
      </aside>

      <main className="casker-main">
        <section
          className="casker-map"
          style={{ background: MAP_BACKGROUND }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: MAP_GRID_BACKGROUND,
              backgroundSize: "32px 32px",
            }}
          />
          <p className="relative z-10 max-w-md px-6 text-center text-sm font-medium text-zinc-700/90">
            [Google Maps / Mapbox Live View - Žilina Region]
          </p>
        </section>

        <section className="casker-bottom-panel" aria-label="Detail dopytu">
          {selectedRequest ? (
            <RequestDetailPanel request={selectedRequest} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
              Kliknite na dopyt v ľavom zozname pre zobrazenie detailov
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
