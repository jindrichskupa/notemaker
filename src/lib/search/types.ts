/**
 * Search types
 */

export interface SearchQuery {
  text: string;
  category?: string;
  labels?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
  labels?: string[];
  modified?: string;
}

export interface SearchFilters {
  category?: string;
  labels: string[];
}
