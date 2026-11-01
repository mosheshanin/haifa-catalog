# HBC — каталог бизнесов и специалистов Хайфы (рабочее название)

Русскоязычный каталог бизнесов и специалистов Хайфы. Один сайт на Next.js работает и как обычный сайт, и как Telegram Mini App.

Техническое задание (источник истины): https://claude.ai/artifact/FRC2GByay4wHeq3jcMyfbV

Стек: Next.js + TypeScript + Tailwind на Vercel, Supabase (Postgres, вход, хранилище фото), Cloudflare (Turnstile, тайлы карты на R2), Google Cloud (вход через Google, отзывы Google), бот на grammY.

Секретные ключи в репозиторий не попадают: локально они лежат в `.env.local`, на сервере — в переменных окружения Vercel.
