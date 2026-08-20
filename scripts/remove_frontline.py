import json

PROD_PATH = "assets/products.json"
MATRIX_PATH = "assets/matrix.json"

FRONTLINE_IDS = {
    "m365_f1",
    "m365_f3",
    "addon_purview_suite_flw",
    "addon_defender_suite_flw",
    "addon_dp_flw",
}

# --- products.json ---
with open(PROD_PATH, encoding="utf-8") as f:
    products = json.load(f)

before = len(products["items"])
products["items"] = [it for it in products["items"] if it["id"] not in FRONTLINE_IDS]
after = len(products["items"])
print(f"products.json: removed {before - after} item(s), {after} remain")

with open(PROD_PATH, "w", encoding="utf-8") as f:
    json.dump(products, f, ensure_ascii=False, indent=2)
    f.write("\n")

# --- matrix.json ---
with open(MATRIX_PATH, encoding="utf-8") as f:
    matrix = json.load(f)

before_cols = len(matrix["planOrder"])
matrix["planOrder"] = [c for c in matrix["planOrder"] if c not in FRONTLINE_IDS]
after_cols = len(matrix["planOrder"])
print(f"matrix.json planOrder: removed {before_cols - after_cols} column(s), {after_cols} remain")

for fid in FRONTLINE_IDS:
    matrix["planMeta"].pop(fid, None)

for feat in matrix["features"]:
    for fid in FRONTLINE_IDS:
        feat["values"].pop(fid, None)

with open(MATRIX_PATH, "w", encoding="utf-8") as f:
    json.dump(matrix, f, ensure_ascii=False, indent=2)
    f.write("\n")

print("Done.")
