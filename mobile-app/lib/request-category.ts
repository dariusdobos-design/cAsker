export type RequestCategoryId = "auto" | "tire" | "towing";

export function getRequestCategoryLabel(category: RequestCategoryId) {
  if (category === "tire") return "Pneuservis";
  if (category === "towing") return "Odťahová služba";
  return "Autoservis";
}
