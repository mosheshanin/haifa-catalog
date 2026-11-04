# Локальная подмена Supabase REST для проверочной сборки, когда настоящий Supabase недоступен
# (например, в песочнице без доступа в интернет). Отдаёт категории и районы из сид-миграции.
# Вторым аргументом можно передать миграцию с примерными карточками — тогда собираются и их страницы.
# Запуск:  python3 -I scripts/supabase-stub.py supabase/migrations/20261101000002_seed_dictionaries.sql \
#            supabase/migrations/20261102000007_card_blocks.sql &
#          NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npm run build
import json, re, sys
from urllib.parse import parse_qs, urlsplit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
seed = open(sys.argv[1], encoding="utf-8").read()
districts, categories = [], []
for i, m in enumerate(re.finditer(r"\('([a-z0-9-]+)', '([^']+)', '(haifa|suburb)', (\d+)\)", seed), 1):
    districts.append({"id": i, "slug": m[1], "name": m[2], "kind": m[3], "sort": int(m[4])})
for i, m in enumerate(re.finditer(r"\('(biznes|specialisty)', '([a-z0-9-]+)', '([^']+)', (\d+), '(\w+)'\)", seed), 1):
    categories.append({"id": i, "section": m[1], "parent_id": None, "slug": m[2], "name": m[3], "sort": int(m[4]),
                       "schema_type": m[5], "seo_title": None, "seo_description": None, "seo_text": None})
# Подкатегории (2 ноября 2026) — из миграции подкатегорий, если она рядом: нужны для проверки скрытия пустых
import glob as _g, os as _o
for f in _g.glob(_o.path.join(_o.path.dirname(_o.path.abspath(sys.argv[1])), "*_subcategories.sql")):
    for m in re.finditer(r"\('(biznes|specialisty)', '([a-z0-9-]+)', '([a-z0-9-]+)', '([^']+)', '([^']*)', (\d+), array", open(f, encoding="utf-8").read()):
        parent = next((c for c in categories if c["section"] == m[1] and c["slug"] == m[2] and c["parent_id"] is None), None)
        if parent:
            categories.append({"id": len(categories) + 1, "section": m[1], "parent_id": parent["id"], "slug": m[3], "name": m[4],
                               "sort": int(m[6]), "schema_type": None, "seo_title": None, "seo_description": None, "seo_text": None})
# Этап 5: свои «Особенности» категорий и тексты страниц категорий — из соседних миграций, если они есть.
import glob, os
mig = os.path.dirname(os.path.abspath(sys.argv[1]))
for c in categories:
    c["amenities"] = []
    c["icon"] = None
    c["icon_3d"] = None
# Иконки категорий: эмодзи и 3D — из миграций иконок (3 ноября 2026)
for pat, key in (("*_category_icons.sql", "icon"), ("*_category_icons_3d.sql", "icon_3d")):
    for f in glob.glob(os.path.join(mig, pat)):
        for m in re.finditer(r"\('(biznes|specialisty)', '([a-z0-9-]+)', '([^']+)'\)", open(f, encoding="utf-8").read()):
            for c in categories:
                if c["section"] == m[1] and c["slug"] == m[2]:
                    c[key] = m[3]
for f in glob.glob(os.path.join(mig, "*_amenities_by_category.sql")):
    for m in re.finditer(r"\('(biznes|specialisty)', '([a-z0-9-]+)', array\[(.*?)\]\)", open(f, encoding="utf-8").read()):
        for c in categories:
            if c["section"] == m[1] and c["slug"] == m[2]:
                c["amenities"] = re.findall(r"'([^']+)'", m[3])
for f in glob.glob(os.path.join(mig, "*_category_texts.sql")):
    for m in re.finditer(r"\('(biznes|specialisty)', '([a-z0-9-]+)', \$t\$(.*?)\$t\$\)", open(f, encoding="utf-8").read(), re.S):
        for c in categories:
            if c["section"] == m[1] and c["slug"] == m[2]:
                c["seo_text"] = m[3]
data = {"categories": sorted(categories, key=lambda c: c["sort"]), "districts": sorted(districts, key=lambda d: d["sort"])}

# Примерные карточки из миграции: jsonb_array_elements('[...]'::jsonb)
listings, versions = [], {}
if len(sys.argv) > 2:
    sql = open(sys.argv[2], encoding="utf-8").read()
    m = re.search(r"jsonb_array_elements\('(\[.*?\])'::jsonb\)", sql, re.S)
    for i, d in enumerate(json.loads(m[1].replace("''", "'")) if m else [], 1):
        vid = f"00000000-0000-0000-0000-{i:012d}"
        cat = next((c["id"] for c in categories if c["section"] == d["section"] and c["slug"] == d["categorySlug"]), None)
        d["data"]["header"]["categoryId"] = cat
        versions[vid] = {"data": d["data"]}
        listings.append({"id": f"10000000-0000-0000-0000-{i:012d}", "section": d["section"], "slug": d["slug"],
                         "category_id": cat, "is_verified": d["verified"], "is_demo": True, "rating_avg": d["rating"],
                         "rating_count": d["reviews"], "short_code": f"demo{i}", "published_version_id": vid,
                         "published_at": "2026-11-01T00:00:00Z", "updated_at": "2026-11-01T00:00:00Z", "status": "published",
                         "is_recommended": d["slug"] in os.environ.get("STUB_RECOMMENDED", "").split(",")})

def rows(name, query):
    q = {k: v[0].removeprefix("eq.") for k, v in parse_qs(query).items() if v[0].startswith("eq.")}
    if name == "listings":
        return [l for l in listings if all(str(l.get(k)) == v for k, v in q.items())]
    if name == "listing_versions":
        return [versions[q["id"]]] if q.get("id") in versions else []
    return None
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        url = urlsplit(self.path)
        path = url.path
        name = path.rsplit("/", 1)[-1]
        found = rows(name, url.query) if path.startswith("/rest/v1/") else None
        if found is not None:
            single = "vnd.pgrst.object" in (self.headers.get("Accept") or "")
            if single and len(found) != 1:
                body = b'{"code":"PGRST116","message":"stub: not one row"}'; code = 406
            else:
                body = json.dumps(found[0] if single else found).encode(); code = 200
        elif path.startswith("/rest/v1/") and name in data:
            body = json.dumps(data[name]).encode(); code = 200
        elif path.startswith("/rest/v1/"):
            body = b"[]"; code = 200
        else:
            body = b'{"message":"stub"}'; code = 401
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
    do_HEAD = do_GET
    def do_POST(self):
        # RPC: search_listings отдаёт примерные карточки (чтобы видеть списки), остальные — пустой результат
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        body = b"[]"
        if self.path.endswith("/rpc/search_listings") and listings:
            try:
                args = json.loads(raw or b"{}")
            except ValueError:
                args = {}
            out = []
            # Фильтр категории (с подкатегориями), как в search_listings
            cat_ids = None
            if args.get("p_category"):
                top = [c["id"] for c in categories if c["slug"] == args["p_category"] and (not args.get("p_section") or c["section"] == args["p_section"])]
                cat_ids = set(top) | {c["id"] for c in categories if c.get("parent_id") in top}
            for l in listings:
                if args.get("p_section") and l["section"] != args["p_section"]:
                    continue
                if cat_ids is not None and l["category_id"] not in cat_ids:
                    continue
                h = versions[l["published_version_id"]]["data"]["header"]
                ids = [d["id"] for d in districts if d["slug"] in h.get("districtSlugs", [])]
                out.append({**l, "title": h["title"], "summary": h.get("profession") or h.get("slogan"), "cover_url": h.get("coverUrl"),
                            "district_ids": ids, "languages": ["Русский", "Иврит"], "formats": [], "has_offer": True, "hours": None,
                            "distance_m": None, "rank": 1, "detected_category": None, "detected_district": None, "total_count": len(listings)})
            # «HBC рекомендует» первыми в категории (STUB_RECOMMENDED — slug карточек через запятую)
            if cat_ids is not None:
                out.sort(key=lambda r: not r["is_recommended"])
            for r in out:
                r["total_count"] = len(out)
            body = json.dumps(out[: int(args.get("p_limit") or 24)]).encode()
        if self.path.endswith("/rpc/category_listing_counts"):
            counts = {}
            for l in listings:
                if l["category_id"] is not None:
                    counts[l["category_id"]] = counts.get(l["category_id"], 0) + 1
            body = json.dumps([{"category_id": k, "listings": v} for k, v in counts.items()]).encode()
        if self.path.endswith("/rpc/category_amenity_counts") and listings:
            args = json.loads(raw or b"{}")
            counts = {}
            for l in listings:
                if l["section"] != args.get("p_section") or (args.get("p_category_id") and l["category_id"] != args["p_category_id"]):
                    continue
                for b in versions[l["published_version_id"]]["data"]["blocks"]:
                    if b.get("type") == "features" and not b.get("hidden"):
                        for a in b["data"].get("items", []):
                            counts[a] = counts.get(a, 0) + 1
            body = json.dumps([{"amenity": a, "n": n} for a, n in counts.items()]).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
print(len(data["categories"]), "categories,", len(data["districts"]), "districts,", len(listings), "demo listings", flush=True)
ThreadingHTTPServer(("127.0.0.1", 54321), H).serve_forever()
