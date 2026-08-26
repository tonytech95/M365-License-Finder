# M365 License Finder

M365 License Finder is a static, client-side tool for finding the least
expensive Microsoft 365 or Office 365 license combination that covers a
selected set of capabilities. Select requirements such as Exchange Online,
Intune, Entra ID, encrypted email, Teams, Office apps, Defender, compliance,
and Windows Enterprise rights. The app compares plans and standalone
add-ons, then displays recommendations and a searchable feature matrix.

The tool is intended for planning and comparison, not as a licensing
quote. It currently covers Microsoft 365 Business and Enterprise plans.
Frontline (F1/F3) plans are intentionally excluded. Prices and product
packaging can change, so verify any recommendation against Microsoft's
official pricing pages before purchasing.

## Run locally

This is a no-build static site. Serve the repository with a local HTTP
server so the browser can load the JSON assets:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000/>. Opening `index.html` directly with
`file://` may prevent the browser from loading `assets/products.json` and
`assets/matrix.json`.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html` | Application markup and metadata |
| `app.js` | Filters, recommendation logic, and matrix rendering |
| `styles.css` | Responsive light/dark theme |
| `assets/products.json` | Curated plans, prices, add-ons, and source metadata |
| `assets/matrix.json` | Feature matrix and plan metadata |
| `scripts/tracked_skus.json` | Microsoft SKU identifiers checked by the refresh script |
| `scripts/refresh_feature_data.py` | Automated SKU/service-plan refresh |
| `data/` | Downloaded source data, snapshots, and refresh history |
| `.github/workflows/pages.yml` | GitHub Pages deployment workflow |

## Updating pricing

Microsoft does not provide a public pricing API or stable pricing feed.
Pricing must therefore be checked manually in `assets/products.json`.

1. Review Microsoft's official pricing sources linked in
   `assets/products.json` under `meta.pricing_summary_source` and each
   product's source fields. The main references include:
   [Microsoft 365 pricing and packaging updates](https://www.microsoft.com/en-us/licensing/news/2026-m365-packaging-pricing-updates),
   [Business plans](https://www.microsoft.com/en-us/microsoft-365/business/with-teams-plans-and-pricing),
   [Office 365 Enterprise](https://www.microsoft.com/en-us/microsoft-365/enterprise/office-365-plans-and-pricing),
   [Microsoft 365 Enterprise](https://www.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plans-and-pricing),
   [Entra ID](https://www.microsoft.com/en-us/security/business/microsoft-entra-pricing),
   and [Intune](https://www.microsoft.com/en-us/security/microsoft-intune-pricing).
2. Update the affected product's price and any changed billing, region,
   commitment, or availability fields in `assets/products.json`.
3. Update `meta.pricing_verified` and `meta.pricing_note` to describe the
   date and pricing assumptions.
4. If packaging or included capabilities changed, update the corresponding
   entries in `assets/products.json` and `assets/matrix.json`.
5. Check the rendered recommendations and review the diff before committing.

The current prices represent US commercial list pricing in USD per
user/month, with annual commitment billed monthly, unless the metadata says
otherwise.

## Updating SKU and service-plan data

Run the refresh script from the repository root:

```powershell
python scripts/refresh_feature_data.py
```

The script downloads Microsoft's machine-readable
[product names and service plan identifiers CSV](https://learn.microsoft.com/en-us/entra/identity/users/licensing-service-plan-reference),
using the stable URL defined in the script. It then:

- refreshes `data/msft_licensing_reference.csv`;
- rebuilds `data/service_plans_snapshot.json` for the SKUs in
  `scripts/tracked_skus.json`;
- appends changes or a no-change entry to `data/refresh_log.md`; and
- updates `assets/products.json` metadata field
  `meta.sku_identifier_checked`.

Exit code `0` means no tracked service-plan changes were found. Exit code
`2` means changes were detected and should be reviewed. A detected change
does not automatically change the human-readable feature matrix or pricing:
manually review the source, then update `assets/matrix.json`,
`assets/products.json`, and `scripts/tracked_skus.json` where appropriate.

## Updating the feature matrix

The matrix is sourced from the community-maintained
[M365 Maps matrix](https://m365maps.com/Microsoft-365-Matrix.xlsx). When
Microsoft changes feature availability:

1. Review the latest matrix and confirm the affected plan and capability.
2. Update `assets/matrix.json`, preserving its existing plan keys and
   feature/category structure.
3. Update `assets/products.json` metadata field
   `meta.feature_matrix_dated`.
4. Check the filters and the full matrix in a browser.

## GitHub Pages

The site is deployed by `.github/workflows/pages.yml` on pushes to
`main`, or manually through the workflow dispatch button. The repository
must have GitHub Pages configured to use **GitHub Actions** as its source.
Because the app uses relative asset paths, it works at the repository Pages
URL:

`https://tonytech95.github.io/M365-License-Finder/`

## Data and licensing notes

The recommendation engine uses the curated data in `assets/products.json`;
the matrix is informational and is not a substitute for Microsoft's
licensing terms. Microsoft names, prices, service plans, and packaging are
subject to change without notice. Always validate the final purchase with
Microsoft or an authorized licensing provider.
