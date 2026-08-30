# Marvel Watchlist

Интерактивный список Marvel-проектов в правильном порядке просмотра. Сайт полностью статический: React-приложение на GitHub Pages, состояние просмотра хранится во внешнем API Mokky.

## Установка

```powershell
npm install
```

## Команды

```powershell
npm run dev
npm run build
npm run preview
```

- `npm run dev` — локальная разработка
- `npm run build` — production-сборка в `dist/`
- `npm run preview` — проверка собранного сайта

## Как это работает

`movies.json` — единственный источник всех проектов: названия, порядок, части, теги, примечания.

Mokky хранит только просмотренные `filmId`.

При загрузке приложение:

1. Берёт MASTER LIST из `src/data/movies.json`
2. Запрашивает `GET /watched`
3. Объединяет данные и показывает актуальные checkbox

Отметить проект:

```text
POST /watched
{ "filmId": "iron-man-2008" }
```

Снять отметку:

```text
DELETE /watched/{id}
```

`id` записи Mokky не является идентификатором фильма.

Если API недоступен, используется последнее состояние из `localStorage`, а изменения ставятся в очередь синхронизации.

## MASTER LIST

Файл: `src/data/movies.json`

Чтобы изменить список, отредактируйте этот файл. Сохраняйте стабильные `id`: именно они связаны с записями в Mokky. Поле `order` — номер из исходного списка, его можно менять отдельно от `id`.

## API endpoint

Адрес задаётся в одном месте:

`src/config.ts`

```ts
export const API_URL = "https://ebfc7a8ba624cb38.mokky.dev/watched";
```

## GitHub Pages

В `vite.config.ts` указано `base: "./"`, поэтому сборка работает и в корне Pages, и в подкаталоге репозитория.

Workflow: `.github/workflows/deploy.yml`

Как включить публикацию:

1. В репозитории откройте **Settings → Pages**
2. Source: **GitHub Actions**
3. Сделайте push в `main` или `master`, либо запустите workflow вручную

После успешного деплоя сайт будет доступен по адресу GitHub Pages.
