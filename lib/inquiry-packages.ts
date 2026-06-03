import type { CompanyProfile } from "./companies";

export type InquiryCategoryAvailability = {
  auto: boolean;
  tire: boolean;
  towing: boolean;
};

/** Kategórie dostupné podľa balíka servisu. Zatiaľ sú všetky povolené. */
export function getInquiryCategoryAvailability(
  _profile?: CompanyProfile | null,
): InquiryCategoryAvailability {
  return {
    auto: true,
    tire: true,
    towing: true,
  };
}
