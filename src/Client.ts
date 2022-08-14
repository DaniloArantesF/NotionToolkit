import { Client } from '@notionhq/client';
import { PageObjectResponse, PartialPageObjectResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';

/** Filter Types */
type ExistencePropertyFilter = { is_empty: true } | { is_not_empty: true }

export type TextPropertyFilter =
  | { equals: string }
  | { does_not_equal: string }
  | { contains: string }
  | { does_not_contain: string }
  | { starts_with: string }
  | { ends_with: string }

  type NumberPropertyFilter =
  | { equals: number }
  | { does_not_equal: number }
  | { greater_than: number }
  | { less_than: number }
  | { greater_than_or_equal_to: number }
  | { less_than_or_equal_to: number }
  | ExistencePropertyFilter

type CheckboxPropertyFilter = { equals: boolean } | { does_not_equal: boolean }

type SelectPropertyFilter =
  | { equals: string }
  | { does_not_equal: string }
  | ExistencePropertyFilter

export type PropertyFilter =
  | { title: TextPropertyFilter; property: string; type?: "title" }
  | { rich_text: TextPropertyFilter; property: string; type?: "rich_text" }
  | { number: NumberPropertyFilter; property: string; type?: "number" }
  | { checkbox: CheckboxPropertyFilter; property: string; type?: "checkbox" }
  | { select: SelectPropertyFilter; property: string; type?: "select" }

export type NotionFilter = {
  or: Array<
    PropertyFilter
    | { or: Array<PropertyFilter> }
    | { and: Array<PropertyFilter> }
  >
} | {
  and: Array<
    PropertyFilter
    | { or: Array<PropertyFilter> }
    | { and: Array<PropertyFilter> }
  >
} | PropertyFilter;

// Single database property
export interface NotionProperty {
  title: string;
  type: 'title' | 'bool' | 'number' | 'text' | 'select';
  formatFn?: (val: string | number) => string | number; // executed on every value of this property
}

// Describes property types and names of a database
export interface NotionSchema {
  [index: string]: NotionProperty;
}

class NotionToolkit {
  notionClient: Client;
  schema: NotionSchema;
  databaseId: string;

  constructor(auth: string, databaseId: string, dbSchema: NotionSchema) {
    this.notionClient = new Client({ auth });
    this.databaseId = databaseId;
    this.schema = dbSchema;
  }

  /**
   *
   * @param query See https://developers.notion.com/reference/post-database-query-filter
   * @param fetchAll If true fetch all pages that match query
   * @returns
   */
  public query = async (query?: NotionFilter, fetchAll=false) => {
    try {
      const pages: (PageObjectResponse | PartialPageObjectResponse)[] = []
      let cursor: string | undefined = undefined;
      while (true) {
        const { results, next_cursor }: QueryDatabaseResponse = await this.notionClient.databases.query({
          database_id: this.databaseId,
          filter: query ? query : undefined,
          start_cursor: cursor
        });

        pages.push(...results);
        if (!next_cursor || !fetchAll) {
          break;
        } else {
          cursor = next_cursor;
        }
      }
      return pages;
    } catch (error) {
      console.error("Error making query.")
    }

  }

  // TODO
  public createPage = async () => {
  }

  // TODO
  public createPages = async () => {
  }

  // TODO
  public updatePage = async () => {
  }

  // TODO
  public updatePages = async () => {
  }

  // TODO
  public deletePage = async () => {
  }

  // TODO
  public deletePages = async () => {
  }
}

export default NotionToolkit;