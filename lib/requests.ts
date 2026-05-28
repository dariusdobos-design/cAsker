import { supabase } from "./supabase";

export type DashboardState = "inquiry" | "waiting" | "done" | "completed";

export type VehicleCategory = "car" | "van";

export type Request = {
  id: string;
  status: DashboardState;
  vehicleCategory: VehicleCategory;
  vehicleName: string;
  vehicleTitle: string;
  service: string;
  licensePlate: string;
  distanceKm: number;
  locationCity: string;
  vin: string;
  engineVolume: string;
  power: string;
  fuelType: string;
  year: number;
  engine: string;
  drive: string;
  bodyType: string;
  doors: number;
  mileageKm: number;
  transmission: string;
  inquiryDescription: string;
  userName: string;
  phone: string;
};

type RequestRow = {
  id: string;
  status: DashboardState;
  vehicle_category?: VehicleCategory | null;
  vehicle_name: string;
  vehicle_title: string;
  service: string;
  license_plate: string;
  distance_km: number;
  location_city: string;
  vin: string;
  engine_volume: string;
  power: string;
  fuel_type: string;
  year: number;
  engine: string;
  drive: string;
  body_type: string;
  doors: number;
  mileage_km: number;
  transmission: string;
  inquiry_description: string;
  user_name: string;
  phone: string;
};

function normalizeVehicleCategory(value?: VehicleCategory | null): VehicleCategory {
  return value === "van" ? "van" : "car";
}

export function formatVehicleCategoryLabel(category: VehicleCategory) {
  return category === "van" ? "Úžitkové vozidlo" : "Osobné auto";
}

function withDefaultCategory(
  request: Omit<Request, "vehicleCategory"> & Partial<Pick<Request, "vehicleCategory">>,
): Request {
  return {
    ...request,
    vehicleCategory: normalizeVehicleCategory(request.vehicleCategory),
  };
}

function mapRequestRow(row: RequestRow): Request {
  return {
    id: row.id,
    status: row.status,
    vehicleCategory: normalizeVehicleCategory(row.vehicle_category),
    vehicleName: row.vehicle_name,
    vehicleTitle: row.vehicle_title,
    service: row.service,
    licensePlate: row.license_plate,
    distanceKm: Number(row.distance_km),
    locationCity: row.location_city,
    vin: row.vin,
    engineVolume: row.engine_volume,
    power: row.power,
    fuelType: row.fuel_type,
    year: row.year,
    engine: row.engine,
    drive: row.drive,
    bodyType: row.body_type,
    doors: row.doors,
    mileageKm: row.mileage_km,
    transmission: row.transmission,
    inquiryDescription: row.inquiry_description,
    userName: row.user_name,
    phone: row.phone,
  };
}

function requestToRow(request: Request, updatedAt?: string) {
  return {
    id: request.id,
    status: request.status,
    vehicle_category: request.vehicleCategory,
    vehicle_name: request.vehicleName,
    vehicle_title: request.vehicleTitle,
    service: request.service,
    license_plate: request.licensePlate,
    distance_km: request.distanceKm,
    location_city: request.locationCity,
    vin: request.vin,
    engine_volume: request.engineVolume,
    power: request.power,
    fuel_type: request.fuelType,
    year: request.year,
    engine: request.engine,
    drive: request.drive,
    body_type: request.bodyType,
    doors: request.doors,
    mileage_km: request.mileageKm,
    transmission: request.transmission,
    inquiry_description: request.inquiryDescription,
    user_name: request.userName,
    phone: request.phone,
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  };
}

export async function upsertRequest(request: Request, updatedAt?: string) {
  const timestamp = updatedAt ?? new Date().toISOString();
  const { error } = await supabase
    .from("requests")
    .upsert(requestToRow(request, timestamp), { onConflict: "id" });

  if (error) throw error;
}

export async function upsertRequests(requests: Request[]) {
  if (requests.length === 0) return;

  const { error } = await supabase
    .from("requests")
    .upsert(requests.map((request) => requestToRow(request)), { onConflict: "id" });

  if (error) throw error;
}

const REQUEST_SELECT_FIELDS =
  "id, status, vehicle_category, vehicle_name, vehicle_title, service, license_plate, distance_km, location_city, vin, engine_volume, power, fuel_type, year, engine, drive, body_type, doors, mileage_km, transmission, inquiry_description, user_name, phone, created_at";

export async function fetchRequestById(requestId: string) {
  const { data, error } = await supabase
    .from("requests")
    .select(REQUEST_SELECT_FIELDS)
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapRequestRow(data as RequestRow);
}

export async function fetchRequests(options?: { allowFallback?: boolean }) {
  const { data, error } = await supabase
    .from("requests")
    .select(REQUEST_SELECT_FIELDS)
    .order("id", { ascending: true });

  if (error) {
    if (error.code === "PGRST205" && options?.allowFallback !== false) {
      return FALLBACK_REQUESTS;
    }
    throw error;
  }

  const fromDb = ((data ?? []) as RequestRow[]).map(mapRequestRow);
  const knownIds = new Set(fromDb.map((request) => request.id));
  const missingFallback = FALLBACK_REQUESTS.filter(
    (request) => !knownIds.has(request.id),
  );

  if (missingFallback.length > 0) {
    try {
      await upsertRequests(missingFallback);
    } catch (syncError) {
      console.warn("Nepodarilo sa synchronizovať demo dopyty do DB:", syncError);
    }
  }

  return [...fromDb, ...missingFallback].filter(
    (request) => request.status !== "completed",
  );
}

export async function completeRequest(request: Request) {
  const updatedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("requests")
    .update({ status: "completed", updated_at: updatedAt })
    .eq("id", request.id);

  if (updateError) throw updateError;

  const { data: verified, error: verifyError } = await supabase
    .from("requests")
    .select("status")
    .eq("id", request.id)
    .maybeSingle();

  if (verifyError) throw verifyError;

  if (verified?.status === "completed") return;

  await upsertRequest({ ...request, status: "completed" }, updatedAt);
}

export async function updateRequestStatus(
  requestId: string,
  status: DashboardState,
) {
  const { error } = await supabase
    .from("requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) throw error;
}

export type CompletedRequest = Request & {
  completedAt: string;
};

type RequestRowWithTimestamps = RequestRow & {
  created_at?: string;
  updated_at?: string;
};

export function formatHistoryDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

export function toHistoryDateKey(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate.slice(0, 10);

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function groupCompletedRequestsByDate(requests: CompletedRequest[]) {
  const groups = new Map<string, CompletedRequest[]>();

  for (const request of requests) {
    const dateKey = toHistoryDateKey(request.completedAt);
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(request);
    groups.set(dateKey, bucket);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatHistoryDateLabel(dateKey),
      requests: items,
    }));
}

export async function fetchCompletedRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select(
      "id, status, vehicle_category, vehicle_name, vehicle_title, service, license_plate, distance_km, location_city, vin, engine_volume, power, fuel_type, year, engine, drive, body_type, doors, mileage_km, transmission, inquiry_description, user_name, phone, created_at, updated_at",
    )
    .eq("status", "completed")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "PGRST205") return [];
    throw error;
  }

  const completed = ((data ?? []) as RequestRowWithTimestamps[]).map((row) => ({
    ...mapRequestRow(row),
    completedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  }));

  return completed.sort((left, right) => {
    const timeDiff =
      new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return right.id.localeCompare(left.id, undefined, { numeric: true });
  });
}

export const FALLBACK_REQUESTS: Request[] = [
  withDefaultCategory({
    id: "1",
    status: "inquiry",
    vehicleName: "Škoda Octavia",
    vehicleTitle: "Škoda Octavia 2.0 TSI",
    service: "Výmena oleja + filtrov",
    licensePlate: "AA970VG",
    distanceKm: 13.4,
    locationCity: "Bytča",
    vin: "TMBBS21Z802123456",
    engineVolume: "1.9 l",
    power: "77 kW",
    fuelType: "Diesel",
    year: 2004,
    engine: "2.0 TSI",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 173651,
    transmission: "Manuálna",
    inquiryDescription:
      "Potrebujem skontrolovať vozidlo, či je na ňom bezpečne jazdiť do doby opravy.",
    userName: "Ján Novák",
    phone: "+421 905 123 456",
  }),
  withDefaultCategory({
    id: "2",
    status: "done",
    vehicleName: "VW Golf",
    vehicleTitle: "VW Golf 1.4 TSI",
    service: "Diagnostika motora",
    licensePlate: "ZA123AB",
    distanceKm: 8.2,
    locationCity: "Žilina",
    vin: "WVWZZZ1KZ6W386752",
    engineVolume: "1.4 l",
    power: "90 kW",
    fuelType: "Benzín",
    year: 2016,
    engine: "1.4 TSI",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 98420,
    transmission: "Automatická",
    inquiryDescription:
      "Motor občas cuká pri studenom štarte, chcem vedieť príčinu a odhad opravy.",
    userName: "Mária Kováčová",
    phone: "+421 911 987 654",
  }),
  withDefaultCategory({
    id: "3",
    status: "done",
    vehicleName: "Ford Focus",
    vehicleTitle: "Ford Focus 1.6 Ti-VCT",
    service: "Výmena brzdových doštičiek",
    licensePlate: "BL456CD",
    distanceKm: 21.7,
    locationCity: "Martin",
    vin: "WF0AXXWPMA1234567",
    engineVolume: "1.6 l",
    power: "85 kW",
    fuelType: "Benzín",
    year: 2012,
    engine: "1.6 Ti-VCT",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 142300,
    transmission: "Manuálna",
    inquiryDescription:
      "Pískanie pri brzdení, prosím o kontrolu a výmenu doštičiek.",
    userName: "Peter Horváth",
    phone: "+421 948 222 333",
  }),
  withDefaultCategory({
    id: "4",
    status: "inquiry",
    vehicleName: "BMW 320d",
    vehicleTitle: "BMW 320d xDrive",
    service: "Kontrola klimatizácie",
    licensePlate: "TN789EF",
    distanceKm: 142.5,
    locationCity: "Poprad",
    vin: "WBA8E310X0A123456",
    engineVolume: "2.0 l",
    power: "140 kW",
    fuelType: "Diesel",
    year: 2018,
    engine: "2.0 d",
    drive: "4x4",
    bodyType: "Sedan",
    doors: 4,
    mileageKm: 86500,
    transmission: "Automatická",
    inquiryDescription:
      "Klimatizácia nechladí dostatočne, prosím o diagnostiku a servis.",
    userName: "Eva Bartošová",
    phone: "+421 903 444 555",
  }),
  withDefaultCategory({
    id: "5",
    status: "inquiry",
    vehicleName: "Audi A4",
    vehicleTitle: "Audi A4 2.0 TDI",
    service: "Kontrola bŕzd",
    licensePlate: "KI111XX",
    distanceKm: 45.3,
    locationCity: "Kysucké Nové Mesto",
    vin: "WAUZZZ8K9KA123456",
    engineVolume: "2.0 l",
    power: "110 kW",
    fuelType: "Diesel",
    year: 2015,
    engine: "2.0 TDI",
    drive: "FWD",
    bodyType: "Sedan",
    doors: 4,
    mileageKm: 198400,
    transmission: "Manuálna",
    inquiryDescription:
      "Pri brzdení cítim vibrácie, prosím o kontrolu kotúčov a doštičiek.",
    userName: "Tomáš Varga",
    phone: "+421 907 111 222",
  }),
  withDefaultCategory({
    id: "6",
    status: "inquiry",
    vehicleName: "Toyota Corolla",
    vehicleTitle: "Toyota Corolla 1.8 Hybrid",
    service: "Servis hybridného systému",
    licensePlate: "ZA456CD",
    distanceKm: 22.8,
    locationCity: "Rajec",
    vin: "JTNKARJE0J1234567",
    engineVolume: "1.8 l",
    power: "90 kW",
    fuelType: "Hybrid",
    year: 2019,
    engine: "1.8 Hybrid",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 75600,
    transmission: "Automatická",
    inquiryDescription:
      "Bliká kontrolka hybridného systému, potrebujem diagnostiku.",
    userName: "Lucia Poláková",
    phone: "+421 918 333 444",
  }),
  withDefaultCategory({
    id: "7",
    status: "inquiry",
    vehicleName: "Peugeot 308",
    vehicleTitle: "Peugeot 308 1.6 HDI",
    service: "Výmena rozvodov",
    licensePlate: "NO789GH",
    distanceKm: 68.9,
    locationCity: "Námestovo",
    vin: "VF3LB9HXBFS123456",
    engineVolume: "1.6 l",
    power: "68 kW",
    fuelType: "Diesel",
    year: 2011,
    engine: "1.6 HDI",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 231500,
    transmission: "Manuálna",
    inquiryDescription:
      "Po studenom štarte počujem rattle, chcem skontrolovať rozvody.",
    userName: "Michal Kollár",
    phone: "+421 949 555 666",
  }),
  withDefaultCategory({
    id: "8",
    status: "inquiry",
    vehicleName: "Honda Civic",
    vehicleTitle: "Honda Civic 1.5 VTEC Turbo",
    service: "Geometria kolies",
    licensePlate: "ZA852MK",
    distanceKm: 11.2,
    locationCity: "Teplička nad Váhom",
    vin: "SHHFK1760HU123456",
    engineVolume: "1.5 l",
    power: "134 kW",
    fuelType: "Benzín",
    year: 2020,
    engine: "1.5 VTEC Turbo",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 62400,
    transmission: "Manuálna",
    inquiryDescription:
      "Auto ťahá doprava, potrebujem nastaviť geometriu a skontrolovať pneumatiky.",
    userName: "Kristína Hudáková",
    phone: "+421 910 222 118",
  }),
  withDefaultCategory({
    id: "9",
    status: "inquiry",
    vehicleName: "Mercedes-Benz C 220",
    vehicleTitle: "Mercedes-Benz C 220 d",
    service: "Servis AdBlue",
    licensePlate: "TN334RS",
    distanceKm: 96.4,
    locationCity: "Liptovský Mikuláš",
    vin: "WDD2050141A123456",
    engineVolume: "2.0 l",
    power: "125 kW",
    fuelType: "Diesel",
    year: 2017,
    engine: "2.0 d",
    drive: "RWD",
    bodyType: "Sedan",
    doors: 4,
    mileageKm: 118900,
    transmission: "Automatická",
    inquiryDescription:
      "Svieti kontrolka AdBlue, prosím o doplnenie a kontrolu systému.",
    userName: "Roman Slanina",
    phone: "+421 905 778 901",
  }),
  withDefaultCategory({
    id: "10",
    status: "inquiry",
    vehicleName: "Suzuki Vitara",
    vehicleTitle: "Suzuki Vitara 1.4 Boosterjet",
    service: "Výmena oleja a filtrov",
    licensePlate: "NO445TU",
    distanceKm: 54.1,
    locationCity: "Tvrdošín",
    vin: "TSMLYEA1S00123456",
    engineVolume: "1.4 l",
    power: "103 kW",
    fuelType: "Benzín",
    year: 2021,
    engine: "1.4 Boosterjet",
    drive: "4x4",
    bodyType: "SUV",
    doors: 5,
    mileageKm: 38700,
    transmission: "Automatická",
    inquiryDescription:
      "Blíži sa servisná prehliadka, chcem výmenu oleja, filtra oleja a vzduchu.",
    userName: "Zuzana Oravcová",
    phone: "+421 917 654 321",
  }),
  withDefaultCategory({
    id: "11",
    status: "inquiry",
    vehicleName: "Opel Astra",
    vehicleTitle: "Opel Astra 1.6 CDTI",
    service: "Diagnostika DPF",
    licensePlate: "KI992OP",
    distanceKm: 31.6,
    locationCity: "Čadca",
    vin: "W0LBF5D99G1234567",
    engineVolume: "1.6 l",
    power: "81 kW",
    fuelType: "Diesel",
    year: 2014,
    engine: "1.6 CDTI",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 167800,
    transmission: "Manuálna",
    inquiryDescription:
      "Auto ide do regenerácie príliš často, chcem skontrolovať DPF a snímače.",
    userName: "Filip Gašpar",
    phone: "+421 944 112 887",
  }),
  withDefaultCategory({
    id: "12",
    status: "inquiry",
    vehicleName: "Mazda 3",
    vehicleTitle: "Mazda 3 2.0 Skyactiv-G",
    service: "Kontrola podvozku",
    licensePlate: "ZA771MZ",
    distanceKm: 17.9,
    locationCity: "Rosina",
    vin: "JM1BPACM1K1234567",
    engineVolume: "2.0 l",
    power: "90 kW",
    fuelType: "Benzín",
    year: 2018,
    engine: "2.0 Skyactiv-G",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 91200,
    transmission: "Manuálna",
    inquiryDescription:
      "Po prejazde nerovnosťou počujem klepanie vpredu, prosím o kontrolu silentblokov.",
    userName: "Andrea Križanová",
    phone: "+421 908 445 776",
  }),
  withDefaultCategory({
    id: "13",
    status: "inquiry",
    vehicleCategory: "van",
    vehicleName: "Ford Transit",
    vehicleTitle: "Ford Transit 2.0 TDCi",
    service: "Výmena oleja a filtrov",
    licensePlate: "ZA331DT",
    distanceKm: 19.4,
    locationCity: "Žilina",
    vin: "WF0XXXTTGX1234567",
    engineVolume: "2.0 l",
    power: "96 kW",
    fuelType: "Diesel",
    year: 2018,
    engine: "2.0 TDCi",
    drive: "FWD",
    bodyType: "Dodávka",
    doors: 4,
    mileageKm: 214800,
    transmission: "Manuálna",
    inquiryDescription:
      "Potrebujem servisnú výmenu oleja a filtrov pred dlhšou trasou po Slovensku.",
    userName: "Martin Ďurica",
    phone: "+421 910 441 220",
  }),
  withDefaultCategory({
    id: "14",
    status: "inquiry",
    vehicleCategory: "van",
    vehicleName: "Mercedes Sprinter",
    vehicleTitle: "Mercedes Sprinter 316 CDI",
    service: "Kontrola bŕzd",
    licensePlate: "NO552SP",
    distanceKm: 37.2,
    locationCity: "Dolný Kubín",
    vin: "WDB9066331S123456",
    engineVolume: "2.1 l",
    power: "120 kW",
    fuelType: "Diesel",
    year: 2016,
    engine: "316 CDI",
    drive: "RWD",
    bodyType: "Dodávka",
    doors: 4,
    mileageKm: 289400,
    transmission: "Manuálna",
    inquiryDescription:
      "Pri plnom zaťažení cítim slabšie brzdenie, prosím o kontrolu brzdového systému.",
    userName: "Jozef Kmeť",
    phone: "+421 949 881 334",
  }),
  withDefaultCategory({
    id: "15",
    status: "done",
    vehicleCategory: "van",
    vehicleName: "VW Crafter",
    vehicleTitle: "VW Crafter 2.0 TDI",
    service: "Diagnostika motora",
    licensePlate: "KI778VC",
    distanceKm: 26.5,
    locationCity: "Bytča",
    vin: "WV1ZZZ2KZJX123456",
    engineVolume: "2.0 l",
    power: "103 kW",
    fuelType: "Diesel",
    year: 2019,
    engine: "2.0 TDI",
    drive: "FWD",
    bodyType: "Dodávka",
    doors: 4,
    mileageKm: 156700,
    transmission: "Automatická",
    inquiryDescription:
      "Občas sa rozsvieti kontrolka motora, auto občas prepne do núdzového režimu.",
    userName: "Silvia Hrušková",
    phone: "+421 918 772 119",
  }),
  withDefaultCategory({
    id: "16",
    status: "inquiry",
    vehicleCategory: "van",
    vehicleName: "Renault Master",
    vehicleTitle: "Renault Master 2.3 dCi",
    service: "Servis klimatizácie",
    licensePlate: "TN904RM",
    distanceKm: 58.7,
    locationCity: "Ružomberok",
    vin: "VF1MA0000H1234567",
    engineVolume: "2.3 l",
    power: "96 kW",
    fuelType: "Diesel",
    year: 2017,
    engine: "2.3 dCi",
    drive: "FWD",
    bodyType: "Dodávka",
    doors: 4,
    mileageKm: 241300,
    transmission: "Manuálna",
    inquiryDescription:
      "Klimatizácia nefúka dostatočne studený vzduch, prosím o kontrolu a doplnenie chladiva.",
    userName: "Dušan Poliak",
    phone: "+421 905 663 778",
  }),
];

export function subscribeToRequestChanges(onChange: () => void) {
  const channel = supabase
    .channel("requests-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "requests" },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
