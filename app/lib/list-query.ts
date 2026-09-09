/**
 * Runs the findMany + count pair every paginated master-data list page needs,
 * in parallel, regardless of which Prisma model is being queried.
 */
export async function fetchPage<Item>(
  findMany: () => Promise<Item[]>,
  count: () => Promise<number>
): Promise<{ items: Item[]; total: number }> {
  const [items, total] = await Promise.all([findMany(), count()]);
  return { items, total };
}
