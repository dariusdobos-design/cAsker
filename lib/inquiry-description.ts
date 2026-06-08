const LOCATION_LINE_PREFIX = "\n\nHľadám servis";

export const INQUIRY_CARD_DESCRIPTION_MAX_LENGTH = 30;

/** Vráti len text zadaný zákazníkom (bez automatických riadkov o polohe / mape). */
export function getInquiryUserDescription(inquiryDescription: string) {
  const markerIndex = inquiryDescription.indexOf(LOCATION_LINE_PREFIX);
  if (markerIndex === -1) {
    return inquiryDescription.trim();
  }
  return inquiryDescription.slice(0, markerIndex).trim();
}

/** Skrátený popis na kartu v zozname (celý text je v detaile po rozkliknutí). */
export function truncateInquiryCardDescription(
  text: string,
  maxLength = INQUIRY_CARD_DESCRIPTION_MAX_LENGTH,
) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}
