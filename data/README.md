# Data sources & refresh mechanism

This tool has two categories of data, and they need different refresh strategies
because Microsoft exposes one as a stable machine-readable file and the other
only as bot-protected marketing pages.

## 1. SKU ↔ service-plan mapping (automatable)

**Source:** Microsoft's own "Product names and service plan identifiers for
licensing" CSV, referenced from
[learn.microsoft.com/.../licensing-service-plan-reference](https://learn.microsoft.com/en-us/entra/identity/users/licensing-service-plan-reference).

Stable direct-download URL (no bot protection, confirmed working via plain
`curl`/`urllib`):

```
https://download.microsoft.com/download/e/3/e/e3e9faf2-f28b-490a-9ada-c6089a1fc5b0/Product%20names%20and%20service%20plan%20identifiers%20for%20licensing.csv
```

Run `scripts/refresh_feature_data.py` to:
1. Re-download the CSV.
2. Rebuild the service-plan list for every tracked SKU (`scripts/tracked_skus.json`).
3. Diff against the last snapshot (`data/service_plans_snapshot.json`).
4. Append a dated entry to `data/refresh_log.md` describing exactly what
   changed (added/removed service plans per SKU).
5. Bump `assets/products.json → meta.sku_identifier_checked` to today's date,
   so the site's freshness banner is always honest about when this was last
   checked — even on a no-change run.

This part **is** a true "OTA" mechanism: it's a plain script (no scraping
workarounds needed) that can run unattended on a schedule and only requires a
human/agent to act when it exits with code `2` (changes detected). It does
**not** update `assets/matrix.json`'s human-readable feature matrix
automatically — that would still need a review pass to translate service-plan
adds/drops into matrix rows — but it gives an early, reliable signal that
something changed upstream so a manual matrix update can be scheduled instead
of skipped indefinitely.

## 2. Pricing (not automatable via script)

Microsoft does not publish a pricing API or feed. The pages are protected by
Akamai bot detection and return "Access Denied" to `curl`/`urllib` — they only
render for a real browser-driven fetch. This means pricing checks can't be a
pure cron script; they need an agent (or a human) to actually browse the page.

Best single official summary page found so far (covers most SKUs in one
table, but not all standalone add-ons):

- [Microsoft 365 Pricing and Packaging Updates](https://www.microsoft.com/en-us/licensing/news/2026-m365-packaging-pricing-updates)

Full per-line pricing pages (needed for the SKUs the summary page omits, e.g.
Exchange Online, Intune Plan 1/2):

- [Business plans & pricing](https://www.microsoft.com/en-us/microsoft-365/business/with-teams-plans-and-pricing)
- [Enterprise (Office 365) pricing](https://www.microsoft.com/en-us/microsoft-365/enterprise/office-365-plans-and-pricing)
- [Enterprise (Microsoft 365) pricing](https://www.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plans-and-pricing)
- [Entra ID pricing](https://www.microsoft.com/en-us/security/business/microsoft-entra-pricing)
- [Intune pricing](https://www.microsoft.com/en-us/security/microsoft-intune-pricing)

Recommended cadence: a scheduled agent task (not a bare script) that fetches
these pages periodically, diffs against a cached snapshot, and only notifies
when a price actually changes. This was proposed but requires explicit
confirmation before being created, since recurring scheduled tasks consume
credits on every run.

## 3. Scope: Business & Enterprise only

Frontline (F1/F3) plans and their add-ons have been removed from
`assets/products.json` and `assets/matrix.json` — the recommendation engine
and feature matrix only ever surface Business or Enterprise line items.
