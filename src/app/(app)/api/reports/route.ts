import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSessionUser, scopeCountyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v == null || v === "") return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "stock";
  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  const scope = scopeCountyId(user);

  let filename = "knfrms-report.csv";
  let csv = "";

  if (type === "stock") {
    filename = "stock-on-hand.csv";
    const res = await db.execute(sql`
      SELECT c.name AS county, w.name AS warehouse, f.name AS commodity, f.unit,
             i.quantity, ROUND((i.quantity * f.kg_per_unit)::numeric, 1) AS weight_kg,
             CASE WHEN i.quantity < f.low_stock_threshold THEN 'LOW' ELSE 'OK' END AS reserve_status,
             i.updated_at
      FROM inventory i
      JOIN food_items f ON f.id = i.food_item_id
      JOIN warehouses w ON w.id = i.warehouse_id
      JOIN counties c ON c.id = w.county_id
      ${scope ? sql`WHERE w.county_id = ${scope}` : sql``}
      ORDER BY c.name, w.name, f.name
    `);
    csv = toCsv(
      ["County", "Warehouse", "Commodity", "Unit", "Quantity", "Weight (kg)", "Reserve status", "Last updated"],
      (res.rows as Record<string, unknown>[]).map((r) => [
        r.county, r.warehouse, r.commodity, r.unit, r.quantity, r.weight_kg, r.reserve_status, r.updated_at,
      ]),
    );
  } else if (type === "beneficiaries") {
    filename = "beneficiaries-by-county.csv";
    const res = await db.execute(sql`
      SELECT c.name AS county,
             count(*) FILTER (WHERE b.active)::int AS registered_households,
             coalesce(sum(b.household_size) FILTER (WHERE b.active), 0)::int AS estimated_people,
             count(*) FILTER (WHERE b.created_at >= now() - interval '30 days')::int AS registered_last_30d
      FROM counties c
      LEFT JOIN beneficiaries b ON b.county_id = c.id
      ${scope ? sql`WHERE c.id = ${scope}` : sql``}
      GROUP BY c.name
      ORDER BY c.name
    `);
    const servedRes = await db.execute(sql`
      SELECT c.name AS county,
             count(DISTINCT ir.beneficiary_id)::int AS households_served
      FROM counties c
      LEFT JOIN distributions d ON d.county_id = c.id
      LEFT JOIN issue_records ir ON ir.distribution_id = d.id
      ${scope ? sql`WHERE c.id = ${scope}` : sql``}
      GROUP BY c.name
    `);
    const served = new Map(
      (servedRes.rows as { county: string; households_served: number }[]).map((r) => [r.county, r.households_served]),
    );
    csv = toCsv(
      ["County", "Registered households (active)", "Estimated people", "Registered last 30 days", "Households ever served"],
      (res.rows as Record<string, unknown>[]).map((r) => [
        r.county, r.registered_households, r.estimated_people, r.registered_last_30d,
        served.get(String(r.county)) ?? 0,
      ]),
    );
  } else if (type === "distributions") {
    filename = "distributions.csv";
    const res = await db.execute(sql`
      SELECT d.ref, d.title, c.name AS county, w.name AS warehouse, d.venue,
             d.scheduled_for, d.status,
             COALESCE(SUM(di.planned_qty),0)::int AS planned_units,
             COALESCE(SUM(di.issued_qty),0)::int AS issued_units,
             ROUND(COALESCE(SUM(di.planned_qty * f.kg_per_unit),0)::numeric,1) AS planned_kg,
             ROUND(COALESCE(SUM(di.issued_qty * f.kg_per_unit),0)::numeric,1) AS issued_kg
      FROM distributions d
      JOIN counties c ON c.id = d.county_id
      JOIN warehouses w ON w.id = d.warehouse_id
      LEFT JOIN distribution_items di ON di.distribution_id = d.id
      LEFT JOIN food_items f ON f.id = di.food_item_id
      ${scope ? sql`WHERE d.county_id = ${scope}` : sql``}
      GROUP BY d.id, c.name, w.name
      ORDER BY d.scheduled_for DESC
    `);
    csv = toCsv(
      ["Reference", "Title", "County", "Warehouse", "Venue", "Scheduled for", "Status", "Planned units", "Issued units", "Planned kg", "Issued kg"],
      (res.rows as Record<string, unknown>[]).map((r) => [
        r.ref, r.title, r.county, r.warehouse, r.venue, r.scheduled_for, r.status,
        r.planned_units, r.issued_units, r.planned_kg, r.issued_kg,
      ]),
    );
  } else if (type === "intake") {
    filename = "stock-intakes-90d.csv";
    const res = await db.execute(sql`
      SELECT si.received_at, c.name AS county, w.name AS warehouse, f.name AS commodity,
             f.unit, si.quantity, si.source, si.reference, u.name AS received_by
      FROM stock_intakes si
      JOIN warehouses w ON w.id = si.warehouse_id
      JOIN counties c ON c.id = w.county_id
      JOIN food_items f ON f.id = si.food_item_id
      LEFT JOIN users u ON u.id = si.received_by_id
      WHERE si.received_at >= now() - interval '90 days'
      ${scope ? sql`AND w.county_id = ${scope}` : sql``}
      ORDER BY si.received_at DESC
      LIMIT 2000
    `);
    csv = toCsv(
      ["Received at", "County", "Warehouse", "Commodity", "Unit", "Quantity", "Source", "Reference", "Received by"],
      (res.rows as Record<string, unknown>[]).map((r) => [
        r.received_at, r.county, r.warehouse, r.commodity, r.unit, r.quantity, r.source, r.reference, r.received_by,
      ]),
    );
  } else if (type === "distribution" && Number.isInteger(id)) {
    filename = `distribution-${id}-ledger.csv`;
    const check = await db.execute(sql`SELECT county_id FROM distributions WHERE id = ${id} LIMIT 1`);
    const distRow = check.rows[0] as { county_id: number } | undefined;
    if (!distRow || (scope && distRow.county_id !== scope)) {
      return new Response("Not found", { status: 404 });
    }
    const res = await db.execute(sql`
      SELECT ir.issued_at, b.full_name, b.national_id, b.phone, f.name AS commodity,
             f.unit, ir.quantity, u.name AS issued_by
      FROM issue_records ir
      JOIN beneficiaries b ON b.id = ir.beneficiary_id
      JOIN food_items f ON f.id = ir.food_item_id
      LEFT JOIN users u ON u.id = ir.issued_by_id
      WHERE ir.distribution_id = ${id}
      ORDER BY ir.issued_at
    `);
    csv = toCsv(
      ["Issued at", "Beneficiary", "National ID", "Phone", "Commodity", "Unit", "Quantity", "Issued by"],
      (res.rows as Record<string, unknown>[]).map((r) => [
        r.issued_at, r.full_name, r.national_id, r.phone, r.commodity, r.unit, r.quantity, r.issued_by,
      ]),
    );
  } else {
    return new Response("Unknown report type", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
