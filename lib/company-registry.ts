const RPO_SEARCH_URL = "https://api.statistics.sk/rpo/v1/search";
const ORSF_COMPANY_URL = "https://api.orsf.sk/v1/companies";

export type CompanyRegistryData = {
  companyName: string;
  billingStreet: string;
  billingCity: string;
  billingZip: string;
  dic: string;
};

type RpoAddress = {
  street?: string;
  regNumber?: number;
  buildingNumber?: string;
  postalCodes?: string[];
  municipality?: { value?: string };
};

type RpoSearchResponse = {
  results?: Array<{
    fullNames?: Array<{ value?: string }>;
    addresses?: RpoAddress[];
  }>;
};

type OrsfCompanyResponse = {
  dic?: string | null;
  taxId?: string | null;
};

export function normalizeIco(value: string): string {
  return value.replace(/\D/g, "");
}

function formatRpoStreet(address: RpoAddress): string {
  const street = address.street?.trim() ?? "";
  const regNumber =
    address.regNumber != null && address.regNumber !== 0
      ? String(address.regNumber)
      : "";
  const buildingNumber = address.buildingNumber?.trim() ?? "";
  const number =
    regNumber && buildingNumber
      ? `${regNumber}/${buildingNumber}`
      : buildingNumber || regNumber;

  return [street, number].filter(Boolean).join(" ");
}

function mapRpoResult(result: NonNullable<RpoSearchResponse["results"]>[number]): CompanyRegistryData {
  const address = result.addresses?.[0];

  return {
    companyName: result.fullNames?.[0]?.value?.trim() ?? "",
    billingStreet: address ? formatRpoStreet(address) : "",
    billingCity: address?.municipality?.value?.trim() ?? "",
    billingZip: address?.postalCodes?.[0]?.trim() ?? "",
    dic: "",
  };
}

export async function fetchCompanyByIco(ico: string): Promise<CompanyRegistryData> {
  const normalizedIco = normalizeIco(ico);

  if (normalizedIco.length !== 8) {
    throw new Error("Zadajte platné IČO (8 číslic).");
  }

  const rpoResponse = await fetch(
    `${RPO_SEARCH_URL}?identifier=${encodeURIComponent(normalizedIco)}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    },
  );

  if (!rpoResponse.ok) {
    throw new Error("Register firiem je dočasne nedostupný. Skúste to neskôr.");
  }

  const rpoData = (await rpoResponse.json()) as RpoSearchResponse;
  const result = rpoData.results?.[0];

  if (!result) {
    throw new Error("Firma s týmto IČO nebola nájdená.");
  }

  const company = mapRpoResult(result);

  try {
    const orsfResponse = await fetch(`${ORSF_COMPANY_URL}/${normalizedIco}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (orsfResponse.ok) {
      const orsfData = (await orsfResponse.json()) as OrsfCompanyResponse;
      company.dic = orsfData.dic?.trim() || orsfData.taxId?.trim() || "";
    }
  } catch {
    // DIČ z ORSF je doplnkový zdroj; RPO údaje stačia aj bez neho.
  }

  return company;
}
