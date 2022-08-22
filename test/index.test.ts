import NotionToolkit, { NotionSchema } from "../src/Client";
import * as dotenv from 'dotenv';
dotenv.config();

const dbId = process.env.TEST_DATABASE_ID ?? '';

test('Valid schema works', async () => {
  const validSchema: NotionSchema = {
    number: {
      title: 'Number Property',
      type: 'number',
    },
    checkbox: {
      title: 'Checkbox Property',
      type: 'checkbox',
    },
    text: {
      title: 'Text Property',
      type: 'text',
    },
    title: { title: 'Title Property', type: 'title' },
  };

  await expect(async () => (await (new NotionToolkit(
    process.env.NOTION_KEY as string,
    dbId,
    validSchema,
  )).checkSchema())).resolves;
});

test('Missing property in schema throws error', async () => {
  const missingSchema: NotionSchema = {
    number: {
      title: 'Number Property',
      type: 'number',
    },
    text: {
      title: 'Text Property',
      type: 'text',
    },
    title: { title: 'Title Property', type: 'title' },
  };

  await expect(async () => (await (new NotionToolkit(
    process.env.NOTION_KEY as string,
    dbId,
    missingSchema,
  )).checkSchema())).rejects.toThrow();
});

test('Wrong type in schema throws error', async () => {
  const wrongTypeSchema: NotionSchema = {
    number: {
      title: 'Number Property',
      type: 'number',
    },
    checkbox: {
      title: 'Checkbox Property',
      type: 'number',
    },
    text: {
      title: 'Text Property',
      type: 'text',
    },
    title: { title: 'Title Property', type: 'title' },
  };

  await expect(async () => (await (new NotionToolkit(
    process.env.NOTION_KEY as string,
    dbId,
    wrongTypeSchema,
  )).checkSchema())).rejects.toThrow();
});

test('Property w/ wrong title in schema throws error', async () => {
  const wrongTitleSchema: NotionSchema = {
    number: {
      title: 'Number Property',
      type: 'number',
    },
    checkbox: {
      title: 'Checkbox Property',
      type: 'checkbox',
    },
    text: {
      title: 'Text',
      type: 'text',
    },
    title: { title: 'Title Property', type: 'title' },
  };

  await expect(async () => (await (new NotionToolkit(
    process.env.NOTION_KEY as string,
    dbId,
    wrongTitleSchema,
  )).checkSchema())).rejects.toThrow();
});