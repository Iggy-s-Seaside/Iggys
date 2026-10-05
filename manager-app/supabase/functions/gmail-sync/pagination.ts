/** Scan past already imported pages. Repeating a capped sync must make progress. */
export async function collectMissingMessages(
  list: (pageToken?: string) => Promise<{ ids: string[]; nextPageToken?: string }>,
  known: (ids: string[]) => Promise<Set<string>>,
  limit: number,
) {
  const todo: string[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;
  let scanned = 0;
  for (let page = 0; page < 20; page++) {
    const result = await list(pageToken);
    scanned += result.ids.length;
    const have = await known(result.ids);
    for (const id of result.ids) {
      if (!have.has(id) && !seen.has(id)) { todo.push(id); seen.add(id); }
    }
    pageToken = result.nextPageToken;
    if (todo.length >= limit || !pageToken) {
      return { todo: todo.slice(0, limit), scanned, truncated: todo.length > limit || !!pageToken };
    }
  }
  return { todo, scanned, truncated: !!pageToken };
}
