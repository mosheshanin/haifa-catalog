# Локальная подмена Supabase REST для проверочной сборки, когда настоящий Supabase недоступен
# (например, в песочнице без доступа в интернет). Отдаёт категории и районы из сид-миграции.
# Запуск:  python3 -I scripts/supabase-stub.py supabase/migrations/20261101000002_seed_dictionaries.sql &
#          NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npm run build
import json, re, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
seed = open(sys.argv[1], encoding="utf-8").read()
districts, categories = [], []
for i, m in enumerate(re.finditer(r"\('([a-z0-9-]+)', '([^']+)', '(haifa|suburb)', (\d+)\)", seed), 1):
    districts.append({"id": i, "slug": m[1], "name": m[2], "kind": m[3], "sort": int(m[4])})
for i, m in enumerate(re.finditer(r"\('(biznes|specialisty)', '([a-z0-9-]+)', '([^']+)', (\d+), '(\w+)'\)", seed), 1):
    categories.append({"id": i, "section": m[1], "parent_id": None, "slug": m[2], "name": m[3], "sort": int(m[4]),
                       "schema_type": m[5], "seo_title": None, "seo_description": None, "seo_text": None})
data = {"categories": sorted(categories, key=lambda c: c["sort"]), "districts": sorted(districts, key=lambda d: d["sort"])}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        path = self.path.split("?")[0]
        name = path.rsplit("/", 1)[-1]
        if path.startswith("/rest/v1/") and name in data:
            body = json.dumps(data[name]).encode(); code = 200
        elif path.startswith("/rest/v1/"):
            body = b"[]"; code = 200
        else:
            body = b'{"message":"stub"}'; code = 401
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
    do_HEAD = do_GET
print(len(data["categories"]), "categories,", len(data["districts"]), "districts", flush=True)
ThreadingHTTPServer(("127.0.0.1", 54321), H).serve_forever()
