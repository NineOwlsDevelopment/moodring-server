import { Category } from "@/api/api";

/**
 * Defines the desired order of categories on the frontend
 */
const CATEGORY_ORDER = [
  "Politics",
  "Sports",
  "Culture",
  "Crypto",
  "Climate",
  "Economics",
  "Mentions",
  "Companies",
  "Financials",
  "Tech & Science",
  "Health",
  "World",
];

/**
 * Sorts categories according to the predefined order.
 * Categories not in the order list will appear at the end, sorted alphabetically.
 */
export const sortCategories = (categories: Category[]): Category[] => {
  const orderMap = new Map<string, number>();
  CATEGORY_ORDER.forEach((name, index) => {
    orderMap.set(name.toLowerCase(), index);
  });

  return [...categories].sort((a, b) => {
    const aOrder = orderMap.get(a.name.toLowerCase());
    const bOrder = orderMap.get(b.name.toLowerCase());

    // Both categories are in the order list
    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }

    // Only a is in the order list
    if (aOrder !== undefined) {
      return -1;
    }

    // Only b is in the order list
    if (bOrder !== undefined) {
      return 1;
    }

    // Neither is in the order list, sort alphabetically
    return a.name.localeCompare(b.name);
  });
};
