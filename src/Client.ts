import { Client } from '@notionhq/client';
import {
  PropertyItemObjectResponse,
  PropertyItemListResponse,
  PageObjectResponse,
  PartialPageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { sleep, typesMap } from './util';
// import cliProgress from 'cli-progress';

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


type PagePropertyValue = string | number | boolean | undefined;

interface PageProperties {
  [index: string]: PagePropertyValue;
}

// partial page
// does not include property values
export interface Page {
  id: string;
  lastEdited: string;
  url: string;
}

export type FullPage = Page & {
  properties: PageProperties | undefined;
};

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
   * Query database
   * Returns list of pages w/o property values
   * @param query See https://developers.notion.com/reference/post-database-query-filter
   * @param fetchAll if omitted return only first 100 pages
   * @returns {Page}
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
      const pages: Page[] = (pagesData as PageObjectResponse[]).map(
        ({ id, last_edited_time, url }) => ({
          id,
          lastEdited: last_edited_time,
          url,
        }),
      );
      return pages;
    } catch (error) {
      console.error('Error making query.');
    }
  };

  /**
   * Fetches pages given by pageIds
   * @param pageIds
   */
  public fetch = async (pageIds: string[]) => {
    const pages: FullPage[] = [];
    for (let i = 0; i < pageIds.length; i++) {
      try {
        pages.push(await this.getPageById(pageIds[i]));
      } catch (error) {
        console.log('Error');
      }
    }
    return pages;
  };

  // used when property values are included
  private formatPageProperties = (page: PageObjectResponse) => {
    const propertyKeys = Object.keys(page.properties);
    const propertyValues: PageProperties = {};

    for (let j = 0; j < propertyKeys.length; j++) {
      const propertyValue = page.properties[propertyKeys[j]] as
        | PropertyItemObjectResponse
        | PropertyItemListResponse;

      let value: PagePropertyValue = '';
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
          case 'title':
            value = property.title.plain_text ?? '';
            break;
          case 'rich_text':
            value = property.rich_text.plain_text ?? '';
            break;
        }
      } // title, rich_text, relation and people are returned as list
      else if (propertyValue.object === 'list') {
        console.log('list');
        const property: PropertyItemListResponse = propertyValue;
        if (property.results[0].type === 'title') {
          value = property.results[0].title.plain_text;
        } else if (property.results[0].type === 'rich_text') {
          value = property.results[0].rich_text.plain_text;
        }
      } else {
        // returned by page.retrieve
        // TODO: figure out types for this
        const property = propertyValue as any;

        switch (property.type) {
          case 'title':
            value = property.title[0]?.plain_text;
            break;
          case 'rich_text':
            value = property.rich_text[0]?.plain_text;
            break;
          case 'number':
            value = property.number;
            break;
          case 'select':
            value = property.select.name;
            break;
        }
      }

      // TODO: change this to schema key
      propertyValues[propertyKeys[j]] = value;
    }

    return propertyValues;
  };

  public getPagesByTitle = async (pageTitle: string) => {
    const schemaProperty = Object.values(this.schema).find(
      ({ title, type }) => type === 'title',
    );
    if (!schemaProperty) {
      return;
    }

    const res = await this.query({
      property: schemaProperty.title,
      rich_text: {
        equals: pageTitle,
      },
    });

    return res;
  };

  public getPageById = async (pageId: string) => {
    const page = (await this.notionClient.pages.retrieve({
      page_id: pageId,
    })) as PageObjectResponse;

    const properties = this.formatPageProperties(page);

    return {
      id: page.id,
      lastEdited: page.last_edited_time,
      url: page.url,
      properties,
    } as FullPage;
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

    try {
      // Create properties payload
      for (const [
        schemaPropertyTitle,
        { title: databasePropertyTitle, type },
      ] of Object.entries(this.schema)) {
        properties[databasePropertyTitle] = this.createPropertyObject(
          schemaPropertyTitle,
          data[schemaPropertyTitle],
        );
      }

      // TODO: stop if error is thrown
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

  private createPropertyObject = (title: string, value: any) => {
    if (!(title in this.schema)) {
      return new Error(`Property ${title}: ${value} is invalid`);
    }
    const { type } = this.schema[title];

    switch (type) {
      case 'title':
        return {
          title: [
            {
              text: {
                content: value,
              },
            },
          ],
        };
        break;
      case 'number':
        return {
          type: 'number',
          number: value,
        };
        break;
      case 'checkbox':
        return {
          checkbox: value,
        };
        break;
      case 'select':
        return {
          select: {
            name: value,
          },
        };
        break;
      case 'text':
        return {
          rich_text: [
            {
              text: {
                content: value !== undefined ? value : '',
              },
            },
          ],
        };
        break;
    }
  };

  // TODO
  public createPages = async () => {};

  /**
   * Updates properties of a page
   * TODO: update block children
   * @param pageId id of page to be updated
   * @param properties new property values
   */
  public updatePage = async (pageId: string, newValues: PageProperties) => {
    const properties: any = {};
    try {
      Object.keys(newValues).forEach((schemaPropertyTitle) => {
        const { title: notionPropertyTitle } = this.schema[schemaPropertyTitle];
        properties[notionPropertyTitle] = this.createPropertyObject(
          schemaPropertyTitle,
          newValues[schemaPropertyTitle],
        );
      });

      const res = await this.notionClient.pages.update({
        page_id: pageId,
        properties,
      });
      return res;
    } catch (error) {
      console.log(error);
    }
  };

  /**
   * Appends an image block to a page
   * @param pageId
   * @param url image url
   */
  public appendImage = async (pageId: string, url: string) => {
    try {
      const res = await this.notionClient.blocks.children.append({
        block_id: pageId,
        children: [
          {
            image: {
              external: {
                url,
              },
            },
          },
        ],
      });
      return true;
    } catch (error) {
      console.log('Error appending block');
      return false;
    }
  };

  // TODO
  public updatePages = async () => {};

  // TODO
  public deletePage = async () => {};

  // TODO
  public deletePages = async () => {};

  /**
   * Called at initialization, checks if given schema is compatible
   * with the database properties
   * @returns true if schema valid false otherwise
   */
  public checkSchema = async () => {
    const database = await this.notionClient.databases.retrieve({
      database_id: this.databaseId,
    });

    // Convert schema to { title: type } for faster lookup
    const keyTypes: { [index: string]: string } = {};
    Object.values(this.schema).forEach(({ title, type }) => {
      // Check if type name is different from notion's and use
      // map if so
      keyTypes[title] = type in typesMap ? typesMap[type] : type;
    });

    // Go through database properties and check that given schema types match
    const schemaValid = Object.values(database.properties).reduce(
      (prev, { name, type }) => {
        if (!keyTypes[name] || keyTypes[name] !== type) {
          return false;
        }
        return prev && true;
      },
      true,
    );

    if (!schemaValid) {
      throw new Error('Schema is not valid!');
    }
  };
}

export default NotionToolkit;
