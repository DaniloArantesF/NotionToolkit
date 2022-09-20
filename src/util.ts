import fs from 'fs';
import path from 'path';

// Some types may be named differently in Notion
// This is used to map back to native type names
export const typesMap: { [index: string]: string } = {
  text: 'rich_text',
};

export const sleep = (ms: number) =>
  new Promise((resolve, reject) => {
    setTimeout(() => resolve({}), ms);
  });

export const saveToFile = async (contents: Object, filename: string) => {
  const filePath = path.resolve(__dirname, '..', 'scrapes', `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(contents, null, 2), 'utf8');
  console.log(filePath);
};
