import { siteUrl } from "@/lib/env";
import { getCategories } from "@/lib/data/dictionaries";
import { t } from "@/i18n/ru";

// /llms.txt — краткое описание сайта и его разделов для ИИ-поисковиков (раздел 8 ТЗ; формат llmstxt.org).
// Эксперимент: подтверждений, что крупные модели его учитывают, пока нет.
export async function GET() {
  const base = siteUrl();
  const categories = await getCategories();
  const list = (section: "biznes" | "specialisty") =>
    categories
      .filter((c) => c.section === section && c.parent_id === null)
      .map((c) => {
        const subs = categories.filter((s) => s.parent_id === c.id).map((s) => s.name);
        return `- [${c.name}](${base}/${section}/${c.slug})${subs.length ? `: ${subs.join(", ")}` : ""}`;
      })
      .join("\n");

  const text = `# ${t.site.brand}

> ${t.site.description}

Каталог на русском языке. Два раздела: бизнесы (заведения, салоны, клиники, магазины, компании) и частные специалисты.
У каждой карточки постоянный адрес вида ${base}/biznes/<название> или ${base}/specialisty/<имя-фамилия>.
В конце каждой карточки — короткое резюме: категория, район, часы работы, языки общения, телефон.
Страницы «категория + район» имеют адрес вида ${base}/biznes/<категория>/<район>.
Данные карточек подтверждают их владельцы; дата подтверждения указана на карточке. Отзывы проходят модерацию.

## Бизнесы

${list("biznes")}

## Специалисты

${list("specialisty")}

## Поиск

- [Поиск по каталогу](${base}/poisk?q=маникюр): параметр q — запрос на русском, распознаёт категорию и район во фразе.

## Документы

- [Политика конфиденциальности](${base}/politika)
- [Условия использования и правила отзывов](${base}/usloviya)
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
