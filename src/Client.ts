import { Client } from '@notionhq/client';
import {
  PropertyItemObjectResponse,
  PropertyItemListResponse,
  PageObjectResponse,
  PartialPageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints';

/** Filter Types */
type ExistencePropertyFilter = { is_empty: true } | { is_not_empty: true };

export type TextPropertyFilter =
  | { equals: string }
  | { does_not_equal: string }
  | { contains: string }
  | { does_not_contain: string }
  | { starts_with: string }
  | { ends_with: string };

type NumberPropertyFilter =
  | { equals: number }
  | { does_not_equal: number }
  | { greater_than: number }
  | { less_than: number }
  | { greater_than_or_equal_to: number }
  | { less_than_or_equal_to: number }
  | ExistencePropertyFilter;

type CheckboxPropertyFilter = { equals: boolean } | { does_not_equal: boolean };

type SelectPropertyFilter =
  | { equals: string }
  | { does_not_equal: string }
  | ExistencePropertyFilter;

export type PropertyFilter =
  | { title: TextPropertyFilter; property: string; type?: 'title' }
  | { rich_text: TextPropertyFilter; property: string; type?: 'rich_text' }
  | { number: NumberPropertyFilter; property: string; type?: 'number' }
  | { checkbox: CheckboxPropertyFilter; property: string; type?: 'checkbox' }
  | { select: SelectPropertyFilter; property: string; type?: 'select' };

export type NotionFilter =
  | {
      or: Array<
        | PropertyFilter
        | { or: Array<PropertyFilter> }
        | { and: Array<PropertyFilter> }
      >;
    }
  | {
      and: Array<
        | PropertyFilter
        | { or: Array<PropertyFilter> }
        | { and: Array<PropertyFilter> }
      >;
    }
  | PropertyFilter;

interface PageProperties {
  [index: string]: string | number | boolean | null;
}

interface Page {
  id: string;
  properties: PageProperties;
  lastEdited: string;
  url: string;
}

// Single database property
export interface NotionProperty {
  title: string;
  type: 'title' | 'checkbox' | 'number' | 'text' | 'select';
  formatFn?: (val: string | number) => string | number; // executed on every value of this property
}

// Describes property types and names of a database
export interface NotionSchema {
  [index: string]: NotionProperty;
}

class NotionToolkit {
  notionClient: Client;

  constructor(
    auth: string,
    public databaseId: string,
    public schema: NotionSchema,
  ) {
    this.notionClient = new Client({ auth });
  }

  /**
   * Query the database and retrieve property values for each page
   * @param query See https://developers.notion.com/reference/post-database-query-filter
   * @param fetchAll if omitted only first page will be fetched
   * @returns
   */
  public query = async (query?: NotionFilter, fetchAll = false) => {
    try {
      const pagesData: (PageObjectResponse | PartialPageObjectResponse)[] = [];
      let cursor: string | undefined = undefined;
      while (true) {
        const { results, next_cursor }: QueryDatabaseResponse =
          await this.notionClient.databases.query({
            database_id: this.databaseId,
            filter: query ? query : undefined,
            start_cursor: cursor,
          });

        pagesData.push(...results);
        if (!next_cursor || !fetchAll) {
          break;
        } else {
          cursor = next_cursor;
        }
      }

      // Get property values & extract useful data
      const pages: Page[] = [];
      const propertyPromises = pagesData.map(async (pageData) => {
        const curPage = pageData as PageObjectResponse;
        const propertyKeys = Object.keys(curPage.properties);
        const propertyValues: PageProperties = {};
        for (let j = 0; j < propertyKeys.length; j++) {
          try {
            const propertyValue =
              await this.notionClient.pages.properties.retrieve({
                page_id: curPage.id,
                property_id: curPage.properties[propertyKeys[j]].id,
              });
            let value: string | number | boolean = '';
            if (propertyValue.object === 'property_item') {
              const property: PropertyItemObjectResponse = propertyValue;
              switch (property.type) {
                case 'checkbox':
                  value = property.checkbox;
                  break;
                case 'date':
                  // TODO
                  break;
                case 'last_edited_time':
                  value = property.last_edited_time;
                  break;
                case 'multi_select':
                  // TODO
                  break;
                case 'number':
                  value = property.number ?? 0;
                  break;
                case 'select':
                  value = property.select?.name ?? '';
                  break;
                case 'status':
                  value = property.status?.name ?? '';
                  break;
                case 'url':
                  value = property.url ?? '';
                  break;
              }
            }

            // title, rich_text, relation and people are returned as list
            if (propertyValue.object == 'list') {
              const property: PropertyItemListResponse = propertyValue;
              if (property.results[0].type === 'title') {
                value = property.results[0].title.plain_text;
              } else if (property.results[0].type === 'rich_text') {
                value = property.results[0].rich_text.plain_text;
              }
            }

            propertyValues[propertyKeys[j]] = value;
          } catch (error) {
            // Error is thrown when value is empty
            propertyValues[propertyKeys[j]] = '';
          }
        }

        pages.push({
          id: curPage.id,
          lastEdited: curPage.last_edited_time,
          properties: propertyValues,
          url: curPage.url,
        });
      });
      await Promise.all(propertyPromises);
      return pages;
    } catch (error) {
      console.error('Error making query.');
    }
  };

  /**
   * Get the block children of a page
   * @param pageId
   * @returns
   */
  public getPageBlockChildren = async (pageId: string) => {
    const res = await this.notionClient.blocks.children.list({
      block_id: pageId,
    });
    // TODO paginate blocks
    return res.results;
  };

  /**
   * Create a page in the notion database
   * Uses the schema to construct a payload following what the notion api expects
   * Will throw errors if values are undefined or types are wrong
   * @param data key value pairs following the schema provided
   * @returns
   */
  public createPage = async (data: any) => {
    const properties: any = {};
    const children: any[] = [];

    // Create properties payload
    for (const [property, { title, type }] of Object.entries(this.schema)) {
      switch (type) {
        case 'title':
          properties[title] = {
            title: [
              {
                text: {
                  content: data[property],
                },
              },
            ],
          };
          break;
        case 'number':
          properties[title] = {
            type: 'number',
            number: data[property],
          };
          break;
        case 'checkbox':
          properties[title] = {
            checkbox: data[property],
          };
          break;
        case 'select':
          properties[title] = {
            select: {
              name: data[property],
            },
          };
          break;
        case 'text':
          properties[title] = {
            rich_text: [
              {
                text: {
                  content: data[property] !== undefined ? data[property] : '',
                },
              },
            ],
          };
          break;
      }
    }

    try {
      const res = await this.notionClient.pages.create({
        parent: { database_id: this.databaseId },
        properties,
        children,
      });
      return res;
    } catch (error) {
      console.log('Error creating page.');
    }
  };

  // TODO
  public createPages = async () => {};

  // TODO
  public updatePage = async () => {};

  // TODO
  public updatePages = async () => {};

  // TODO
  public deletePage = async () => {};

  // TODO
  public deletePages = async () => {};

  // TODO
  private checkSchema = async () => {};
}

export default NotionToolkit;
