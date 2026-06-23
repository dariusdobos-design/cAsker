export const MAX_INQUIRY_PHOTOS = 4;

const DATA_IMAGE_PREFIX = /^data:image\/(jpeg|png);base64,/i;

export function normalizeInquiryPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .filter((item) => DATA_IMAGE_PREFIX.test(item.trim()))
    .slice(0, MAX_INQUIRY_PHOTOS);
}
