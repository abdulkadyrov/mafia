Mafia LAN PWA

React + Vite + TypeScript проект игры "Мафия" с realtime-лобби на Supabase.

Запуск локально:

```bash
npm install
npm run dev
```

## Подключение Supabase

1. Создать проект Supabase.
2. Открыть `Project Settings`.
3. Найти `Project URL`.
4. Найти `anon public key`.
5. Создать `.env.local`.
6. Вставить ключи.
7. Открыть `SQL Editor`.
8. Запустить `supabase/schema.sql`.
9. Запустить проект командой `npm run dev`.

Пример `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Шаблон переменных уже лежит в `.env.example`.

## Что уже подключено

- создание комнаты с 6-значным кодом;
- вход в комнату по коду;
- сохранение `room`, `players`, `votes`, `night_actions`, `game_events` в Supabase;
- realtime-подписки на комнату и игроков;
- восстановление `roomId`, `playerId`, `roomCode` через `localStorage`.

## Полезные файлы

- `src/services/supabaseClient.ts`
- `src/services/roomService.ts`
- `src/services/playerService.ts`
- `src/services/gameService.ts`
- `src/services/realtimeService.ts`
- `src/types/database.ts`
- `supabase/schema.sql`

## Примечание по безопасности

Для MVP в `supabase/schema.sql` включён RLS с простыми политиками для `anon` на чтение и запись игровых таблиц. Перед production-деплоем эти политики нужно ужесточить.
