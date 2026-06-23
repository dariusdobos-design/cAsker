const LOCATION_LINE_PREFIX = "\n\nHľadám servis";
const DIRECT_LINE_PREFIX = "\n\nPriamy dopyt pre";

export const INQUIRY_CARD_DESCRIPTION_MAX_LENGTH = 72;

/** Vráti len text zadaný zákazníkom (bez automatických riadkov o polohe). */
export function getDriverInquiryUserDescription(inquiryDescription: string) {
  let markerIndex = inquiryDescription.indexOf(LOCATION_LINE_PREFIX);
  if (markerIndex === -1) {
    markerIndex = inquiryDescription.indexOf(DIRECT_LINE_PREFIX);
  }
  if (markerIndex === -1) {
    return inquiryDescription.trim();
  }
  return inquiryDescription.slice(0, markerIndex).trim();
}

export function truncateDriverInquiryCardDescription(
  text: string,
  maxLength = INQUIRY_CARD_DESCRIPTION_MAX_LENGTH,
) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}
