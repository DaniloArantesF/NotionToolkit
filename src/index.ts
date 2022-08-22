import dotenv from 'dotenv';
import NotionToolkit, { NotionSchema } from './Client';
dotenv.config();

// test db schema
const dbSchema: NotionSchema = {
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

const dbId = process.env.TEST_DATABASE_ID ?? '';

async function main() {
  const Notion = new NotionToolkit(
    process.env.NOTION_KEY as string,
    dbId,
    dbSchema,
  );

  const pages = await Notion.query();
  console.log(pages);
}

main();
