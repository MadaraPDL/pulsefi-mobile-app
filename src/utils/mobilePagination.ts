export const MOBILE_PAGE_SIZE = 5;

export function paginateMobileRows<T>(
  rows: T[],
  page: number,
  pageSize = MOBILE_PAGE_SIZE
) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;

  return {
    safePage,
    pageCount,
    pageRows: rows.slice(start, start + pageSize),
  };
}
