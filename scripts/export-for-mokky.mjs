// Подготовка списка проектов для Mokky.
//
// У Mokky свой числовой `id` записи, поэтому строковый идентификатор проекта
// (например, "iron-man-2008") хранится в поле `slug`.
//
// Использование:
//   node scripts/export-for-mokky.mjs
//       -> создаёт scripts/movies.mokky.json (можно импортировать в дашборде Mokky)
//   node scripts/export-for-mokky.mjs --upload https://<project>.mokky.dev/movies
//       -> последовательно отправляет записи POST-запросами в коллекцию

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "scripts", "movies.seed.json");
const target = path.join(root, "scripts", "movies.mokky.json");

if (!fs.existsSync(source)) {
  console.error(`Не найден ${source}`);
  process.exit(1);
}

const movies = JSON.parse(fs.readFileSync(source, "utf8"));
const records = movies
  .slice()
  .sort((a, b) => a.order - b.order)
  .map(({ id, ...rest }) => ({ slug: id, ...rest }));

const slugs = new Set(records.map((record) => record.slug));
if (slugs.size !== records.length) {
  console.error("В списке есть повторяющиеся id");
  process.exit(1);
}

fs.writeFileSync(target, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Записей: ${records.length}. Файл: ${target}`);

const uploadIndex = process.argv.indexOf("--upload");
if (uploadIndex !== -1) {
  const url = process.argv[uploadIndex + 1];
  if (!url || !/^https?:\/\//.test(url)) {
    console.error("После --upload укажите адрес коллекции, например https://xxx.mokky.dev/movies");
    process.exit(1);
  }

  let created = 0;
  for (const record of records) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(record),
    });
    if (!response.ok) {
      console.error(`Ошибка ${response.status} на записи ${record.slug}. Создано: ${created}`);
      process.exit(1);
    }
    created += 1;
  }
  console.log(`Загружено в Mokky: ${created}`);
}
