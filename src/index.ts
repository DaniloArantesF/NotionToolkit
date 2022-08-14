import dotenv from 'dotenv';
import NotionToolkit, { NotionSchema } from './Client';
dotenv.config();

const dbSchema: NotionSchema = {
  refNumber: { title: 'Reference Number', type: 'title' },
  // want: { title: 'Want', type: 'bool' },
  title: {
    title: 'Title',
    type: 'text',
  },
  brand: { title: 'Brand', type: 'select' },
  diameter: { title: 'Size', type: 'text' },
  movement: { title: 'Movement', type: 'text' },
  material: { title: 'Case Material', type: 'text' },
  dialMaterial: { title: 'Dial Material', type: 'text' },
  bezelMaterial: { title: 'Bezel Material', type: 'text' },
  bracelet: { title: 'Bracelet', type: 'text' },
  buckle: { title: 'Buckle', type: 'text' },
  hands: { title: 'Hands', type: 'text' },
  crystal: { title: 'Crystal', type: 'text' },
  waterResistance: { title: 'Water Resistance', type: 'text' },
  collection: { title: 'Collection', type: 'text' }
};

const dbId = process.env.TEST_DATABASE_ID ?? "";

async function main() {
  const Notion = new NotionToolkit(process.env.NOTION_KEY as string, dbId, dbSchema);
  const res = await Notion.query();
  console.log(res);
}

main()