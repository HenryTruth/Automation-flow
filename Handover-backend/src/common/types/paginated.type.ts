import { PaginationMeta } from '../utils/pagination.util';

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}
