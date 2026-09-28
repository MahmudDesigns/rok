/**
 * Seed script — National Food Relief Management System (Kenya)
 * Run with: npx tsx src/db/seed.ts
 */
import "dotenv/config";
import { scryptSync, randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./index";
import {
  auditLogs,
  beneficiaries,
  counties,
  distributionItems,
  distributions,
  foodItems,
  inventory,
  issueRecords,
  notifications,
  stockIntakes,
  users,
  warehouses,
} from "./schema";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Deterministic PRNG so re-seeds are stable
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260120);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const daysAgo = (n: number, h = 9) => new Date(Date.now() - n * 864e5 - h * 36e5);
const daysAhead = (n: number, h = 8) => new Date(Date.now() + n * 864e5 + h * 36e5);

const COUNTIES: Array<{ name: string; code: string; asal?: boolean }> = [
  { name: "Mombasa", code: "001", asal: true },
  { name: "Kwale", code: "002", asal: true },
  { name: "Kilifi", code: "003", asal: true },
  { name: "Tana River", code: "004", asal: true },
  { name: "Lamu", code: "005", asal: true },
  { name: "Taita Taveta", code: "006", asal: true },
  { name: "Garissa", code: "007", asal: true },
  { name: "Wajir", code: "008", asal: true },
  { name: "Mandera", code: "009", asal: true },
  { name: "Marsabit", code: "010", asal: true },
  { name: "Isiolo", code: "011", asal: true },
  { name: "Meru", code: "012" },
  { name: "Tharaka-Nithi", code: "013" },
  { name: "Embu", code: "014" },
  { name: "Kitui", code: "015", asal: true },
  { name: "Machakos", code: "016", asal: true },
  { name: "Makueni", code: "017", asal: true },
  { name: "Nyandarua", code: "018" },
  { name: "Nyeri", code: "019" },
  { name: "Kirinyaga", code: "020" },
  { name: "Murang'a", code: "021" },
  { name: "Kiambu", code: "022" },
  { name: "Turkana", code: "023", asal: true },
  { name: "West Pokot", code: "024", asal: true },
  { name: "Samburu", code: "025", asal: true },
  { name: "Trans Nzoia", code: "026" },
  { name: "Uasin Gishu", code: "027" },
  { name: "Elgeyo Marakwet", code: "028" },
  { name: "Nandi", code: "029" },
  { name: "Baringo", code: "030", asal: true },
  { name: "Laikipia", code: "031", asal: true },
  { name: "Nakuru", code: "032" },
  { name: "Narok", code: "033", asal: true },
  { name: "Kajiado", code: "034", asal: true },
  { name: "Kericho", code: "035" },
  { name: "Bomet", code: "036" },
  { name: "Kakamega", code: "037" },
  { name: "Vihiga", code: "038" },
  { name: "Bungoma", code: "039" },
  { name: "Busia", code: "040" },
  { name: "Siaya", code: "041" },
  { name: "Kisumu", code: "042" },
  { name: "Homa Bay", code: "043" },
  { name: "Migori", code: "044" },
  { name: "Kisii", code: "045" },
  { name: "Nyamira", code: "046" },
  { name: "Nairobi", code: "047" },
];

const FIRST_F = ["Wanjiru", "Atieno", "Achieng", "Nduta", "Njeri", "Cherono", "Muthoni", "Jepkorir", "Waithera", "Mumbi", "Cheptoo", "Nakutan", "Awuor", "Moraa", "Nyambura", "Naliaka", "Adhiambo", "Kanini", "Kawira", "Esekon"];
const FIRST_M = ["Otieno", "Kamau", "Mwangi", "Kiptoo", "Ochieng", "Njoroge", "Barasa", "Ekiru", "Wafula", "Kibet", "Muriuki", "Onyango", "Lokorio", "Mutua", "Kiprop", "Ebei", "Omondi", "Gitonga", "Mwenda", "Lemayan"];
const LAST = ["Kiplagat", "Odhiambo", "Maina", "Kariuki", "Owuor", "Chebet", "Njuguna", "Toroitich", "Auma", "Kilonzo", "Makena", "Lesingo", "Napeikar", "Wambui", "Rotich", "Muchiri", "Amoit", "Long'or", "Situma", "Koech", "Nyong'o", "Ewoi", "Mworia", "Nasike"];
const VULNS = ["NONE", "NONE", "NONE", "ELDERLY", "DISABLED", "ORPHANED", "CHRONICALLY_ILL", "PREGNANT_LACTATING", "PREGNANT_LACTATING"];
const SUBS: Record<string, string[]> = {
  default: ["Central", "North", "South", "East", "West"],
};

function makePhone(): string {
  return `07${int(0, 1)}${int(0, 9)}${int(100000, 999999)}`;
}

function makeNationalId(used: Set<string>): string {
  let id = "";
  do {
    id = String(int(10000000, 39999999));
  } while (used.has(id));
  used.add(id);
  return id;
}

async function main() {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }

  console.log("Seeding counties…");
  const countyRows = await db
    .insert(counties)
    .values(COUNTIES.map((c) => ({ name: c.name, code: c.code, isAsal: !!c.asal })))
    .returning();
  const countyByName = new Map(countyRows.map((c) => [c.name, c]));
  const cid = (name: string) => countyByName.get(name)!.id;

  console.log("Seeding users…");
  const pw = hashPassword("Relief@123");
  const [admin, national, turkanaOfficer, warehouseMgr, partner] = await db
    .insert(users)
    .values([
      { name: "Agnes Naliaka", email: "admin@gokrelief.go.ke", passwordHash: pw, role: "ADMIN", phone: "+254 20 222 7411" },
      { name: "Daniel Kiprop", email: "national@gokrelief.go.ke", passwordHash: pw, role: "NATIONAL_OFFICER", phone: "+254 20 222 7412" },
      { name: "Ekwam Arot", email: "turkana@gokrelief.go.ke", passwordHash: pw, role: "COUNTY_OFFICER", countyId: cid("Turkana"), phone: "+254 754 221 090" },
      { name: "Mary Adhiambo", email: "warehouse@gokrelief.go.ke", passwordHash: pw, role: "WAREHOUSE_MANAGER", countyId: cid("Nakuru"), phone: "+254 722 408 331" },
      { name: "Samuel Karanja", email: "partner@relieforg.or.ke", passwordHash: pw, role: "PARTNER", phone: "+254 733 910 552" },
    ])
    .returning();

  console.log("Seeding warehouses…");
  const whSeed = [
    { name: "NCPB Nairobi Central Depot", county: "Nairobi", location: "Industrial Area, off Enterprise Rd", capacityTonnes: 2400 },
    { name: "NCPB Nakuru Silos", county: "Nakuru", location: "Section 58, Nakuru", capacityTonnes: 1800 },
    { name: "NCPB Eldoret Depot", county: "Uasin Gishu", location: "Uganda Rd, Eldoret", capacityTonnes: 1500 },
    { name: "Lodwar Forward Relief Store", county: "Turkana", location: "Airport Rd, Lodwar", capacityTonnes: 900 },
    { name: "Garissa Regional Relief Store", county: "Garissa", location: "Kismaiyu Rd, Garissa", capacityTonnes: 1100 },
    { name: "Wajir County Store", county: "Wajir", location: "Airport Rd, Wajir", capacityTonnes: 700 },
    { name: "Isiolo Aggregation Centre", county: "Isiolo", location: "Nairobi–Moyale Hwy", capacityTonnes: 800 },
    { name: "Kitui County Store", county: "Kitui", location: "Kalundu, Kitui", capacityTonnes: 750 },
    { name: "Mombasa Port Godown 12", county: "Mombasa", location: "Port Reitz, Changamwe", capacityTonnes: 2000 },
    { name: "Marsabit Forward Store", county: "Marsabit", location: "Moyale Rd, Marsabit", capacityTonnes: 600 },
  ];
  const whRows = await db
    .insert(warehouses)
    .values(whSeed.map((w) => ({ name: w.name, countyId: cid(w.county), location: w.location, capacityTonnes: w.capacityTonnes })))
    .returning();

  console.log("Seeding food commodities…");
  const itemSeed = [
    { name: "Maize flour (fortified)", category: "Cereals", unit: "90 kg bag", kgPerUnit: 90, lowStockThreshold: 300 },
    { name: "Dried beans (nyayo)", category: "Pulses", unit: "90 kg bag", kgPerUnit: 90, lowStockThreshold: 200 },
    { name: "Rice (pishori)", category: "Cereals", unit: "50 kg bag", kgPerUnit: 50, lowStockThreshold: 250 },
    { name: "Sorghum grain", category: "Cereals", unit: "90 kg bag", kgPerUnit: 90, lowStockThreshold: 200 },
    { name: "Vegetable cooking oil", category: "Oils & fats", unit: "20 L jerrican", kgPerUnit: 18.4, lowStockThreshold: 250 },
    { name: "Green grams (ndengu)", category: "Pulses", unit: "90 kg bag", kgPerUnit: 90, lowStockThreshold: 120 },
    { name: "Corn-soya blend (CSB+)", category: "Fortified foods", unit: "25 kg bag", kgPerUnit: 25, lowStockThreshold: 150 },
    { name: "Fortified porridge flour", category: "Fortified foods", unit: "25 kg bag", kgPerUnit: 25, lowStockThreshold: 150 },
    { name: "Iodised salt", category: "Essentials", unit: "25 kg bag", kgPerUnit: 25, lowStockThreshold: 100 },
  ];
  const itemRows = await db.insert(foodItems).values(itemSeed).returning();
  const [maize, beans, rice, sorghum, oil, grams, csb, porridge, salt] = itemRows;

  console.log("Seeding inventory…");
  const invSeed: Array<[number, number, number]> = [
    // Nairobi
    [whRows[0].id, maize.id, 2400], [whRows[0].id, beans.id, 900], [whRows[0].id, rice.id, 1200],
    [whRows[0].id, oil.id, 1500], [whRows[0].id, csb.id, 600], [whRows[0].id, salt.id, 400],
    // Nakuru
    [whRows[1].id, maize.id, 1800], [whRows[1].id, beans.id, 640], [whRows[1].id, rice.id, 520],
    [whRows[1].id, oil.id, 880], [whRows[1].id, porridge.id, 300], [whRows[1].id, salt.id, 260],
    // Eldoret
    [whRows[2].id, maize.id, 1500], [whRows[2].id, beans.id, 480], [whRows[2].id, sorghum.id, 610],
    [whRows[2].id, oil.id, 540], [whRows[2].id, grams.id, 300],
    // Lodwar (Turkana) — some low stock
    [whRows[3].id, maize.id, 220], [whRows[3].id, beans.id, 140], [whRows[3].id, oil.id, 96],
    [whRows[3].id, csb.id, 180], [whRows[3].id, porridge.id, 120],
    // Garissa
    [whRows[4].id, maize.id, 860], [whRows[4].id, rice.id, 420], [whRows[4].id, oil.id, 380],
    [whRows[4].id, sorghum.id, 350], [whRows[4].id, salt.id, 90], // salt low
    // Wajir
    [whRows[5].id, maize.id, 480], [whRows[5].id, rice.id, 260], [whRows[5].id, oil.id, 210], [whRows[5].id, grams.id, 110],
    // Isiolo
    [whRows[6].id, maize.id, 540], [whRows[6].id, beans.id, 320], [whRows[6].id, oil.id, 260], [whRows[6].id, csb.id, 140],
    // Kitui
    [whRows[7].id, maize.id, 610], [whRows[7].id, grams.id, 340], [whRows[7].id, oil.id, 300], [whRows[7].id, porridge.id, 160],
    // Mombasa
    [whRows[8].id, rice.id, 1600], [whRows[8].id, maize.id, 900], [whRows[8].id, oil.id, 1100], [whRows[8].id, salt.id, 500],
    // Marsabit
    [whRows[9].id, maize.id, 300], [whRows[9].id, sorghum.id, 180], [whRows[9].id, oil.id, 130], [whRows[9].id, csb.id, 72], // csb low
  ];
  await db.insert(inventory).values(
    invSeed.map(([warehouseId, foodItemId, quantity]) => ({ warehouseId, foodItemId, quantity, updatedAt: daysAgo(int(1, 20)) })),
  );

  console.log("Seeding stock intake history…");
  const intakeSeed: Array<{ w: number; i: number; q: number; src: string; ref: string; by: number; when: Date }> = [];
  const sources = [
    "National Food Reserve (NCPB)",
    "Strategic Food Reserve Trust Fund",
    "World Food Programme (WFP)",
    "Kenya Red Cross Society",
    "County Government Purchase",
  ];
  for (let k = 0; k < 30; k++) {
    const wIdx = int(0, whRows.length - 1);
    const iIdx = int(0, itemRows.length - 1);
    intakeSeed.push({
      w: whRows[wIdx].id,
      i: itemRows[iIdx].id,
      q: int(80, 900),
      src: pick(sources),
      ref: `NCPB/GRN/${2025}${String(int(1000, 9899))}`,
      by: pick([warehouseMgr, national, admin]).id,
      when: daysAgo(int(2, 75), int(7, 17)),
    });
  }
  await db.insert(stockIntakes).values(
    intakeSeed.map((s) => ({ warehouseId: s.w, foodItemId: s.i, quantity: s.q, source: s.src, reference: s.ref, receivedById: s.by, receivedAt: s.when })),
  );

  console.log("Seeding beneficiaries…");
  const usedIds = new Set<string>();
  const weightCounties = [
    "Turkana", "Turkana", "Turkana", "Garissa", "Garissa", "Marsabit", "Wajir", "Isiolo",
    "Kitui", "Makueni", "Kajiado", "Samburu", "Nakuru", "Nairobi", "Kilifi", "Tana River",
    "West Pokot", "Baringo", "Mandera", "Narok",
  ];
  const benRows: Array<typeof beneficiaries.$inferInsert> = [];
  for (let k = 0; k < 220; k++) {
    const female = rand() < 0.62;
    const countyName = pick(weightCounties);
    const sub = pick(SUBS.default) + " Sub-County";
    benRows.push({
      nationalId: makeNationalId(usedIds),
      fullName: `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`,
      gender: female ? "FEMALE" : "MALE",
      birthYear: int(1938, 2012),
      phone: rand() < 0.86 ? makePhone() : null,
      countyId: cid(countyName),
      subCounty: `${countyName} ${sub}`,
      village: `${pick(LAST)} Village`,
      householdSize: int(1, 11),
      vulnerability: pick(VULNS),
      registeredById: pick([turkanaOfficer, national, admin]).id,
      createdAt: daysAgo(int(1, 120), int(7, 18)),
    });
  }
  const insertedBens = await db.insert(beneficiaries).values(benRows).returning();

  console.log("Seeding distributions…");
  // 1. COMPLETED — Turkana drought response
  const [d1] = await db
    .insert(distributions)
    .values({
      ref: "KRD/2025/0107",
      title: "Turkana South — Kalokol drought response",
      countyId: cid("Turkana"),
      warehouseId: whRows[3].id,
      venue: "Kalokol Primary School grounds",
      scheduledFor: daysAgo(21, 8),
      status: "COMPLETED",
      notes: "Priority to households registered under the Enhanced Single Registry drought caseload.",
      createdById: turkanaOfficer.id,
      createdAt: daysAgo(26, 10),
      completedAt: daysAgo(21, 15),
    })
    .returning();
  await db.insert(distributionItems).values([
    { distributionId: d1.id, foodItemId: maize.id, plannedQty: 300, issuedQty: 288 },
    { distributionId: d1.id, foodItemId: beans.id, plannedQty: 160, issuedQty: 156 },
    { distributionId: d1.id, foodItemId: oil.id, plannedQty: 220, issuedQty: 218 },
  ]).onConflictDoNothing();

  const turkanaBens = insertedBens.filter((b) => b.countyId === cid("Turkana")).slice(0, 36);
  const issueRows1: Array<typeof issueRecords.$inferInsert> = [];
  for (const b of turkanaBens) {
    issueRows1.push({ distributionId: d1.id, beneficiaryId: b.id, foodItemId: maize.id, quantity: 8, issuedById: turkanaOfficer.id, issuedAt: daysAgo(21, int(9, 14)) });
    if (rand() < 0.86) issueRows1.push({ distributionId: d1.id, beneficiaryId: b.id, foodItemId: oil.id, quantity: 6, issuedById: turkanaOfficer.id, issuedAt: daysAgo(21, int(9, 14)) });
    if (rand() < 0.7) issueRows1.push({ distributionId: d1.id, beneficiaryId: b.id, foodItemId: beans.id, quantity: 4, issuedById: turkanaOfficer.id, issuedAt: daysAgo(21, int(9, 14)) });
  }
  await db.insert(issueRecords).values(issueRows1);

  // 2. ACTIVE — Garissa flood relief
  const [d2] = await db
    .insert(distributions)
    .values({
      ref: "KRD/2025/0112",
      title: "Garissa West — Tana flood relief",
      countyId: cid("Garissa"),
      warehouseId: whRows[4].id,
      venue: "Sankuri distribution point",
      scheduledFor: daysAgo(1, 7),
      status: "ACTIVE",
      notes: "Households displaced by Tana River flooding. Two-day exercise.",
      createdById: national.id,
      createdAt: daysAgo(4, 11),
    })
    .returning();
  await db.insert(distributionItems).values([
    { distributionId: d2.id, foodItemId: maize.id, plannedQty: 240, issuedQty: 96 },
    { distributionId: d2.id, foodItemId: rice.id, plannedQty: 140, issuedQty: 61 },
    { distributionId: d2.id, foodItemId: oil.id, plannedQty: 160, issuedQty: 78 },
  ]).onConflictDoNothing();
  const garissaBens = insertedBens.filter((b) => b.countyId === cid("Garissa")).slice(0, 24);
  const issueRows2: Array<typeof issueRecords.$inferInsert> = [];
  for (const b of garissaBens) {
    issueRows2.push({ distributionId: d2.id, beneficiaryId: b.id, foodItemId: maize.id, quantity: 4, issuedById: national.id, issuedAt: daysAgo(1, int(8, 15)) });
    if (rand() < 0.8) issueRows2.push({ distributionId: d2.id, beneficiaryId: b.id, foodItemId: rice.id, quantity: 2, issuedById: national.id, issuedAt: daysAgo(1, int(8, 15)) });
  }
  await db.insert(issueRecords).values(issueRows2);

  // 3. SCHEDULED — Marsabit
  const [d3] = await db
    .insert(distributions)
    .values({
      ref: "KRD/2025/0118",
      title: "Marsabit — North Horr & Moyale corridor",
      countyId: cid("Marsabit"),
      warehouseId: whRows[9].id,
      venue: "North Horr chief's camp",
      scheduledFor: daysAhead(4, 7),
      status: "SCHEDULED",
      notes: "Joint exercise with Kenya Red Cross. Verify national IDs at point of issue.",
      createdById: national.id,
      createdAt: daysAgo(2, 12),
    })
    .returning();
  await db.insert(distributionItems).values([
    { distributionId: d3.id, foodItemId: maize.id, plannedQty: 120, issuedQty: 0 },
    { distributionId: d3.id, foodItemId: oil.id, plannedQty: 60, issuedQty: 0 },
    { distributionId: d3.id, foodItemId: csb.id, plannedQty: 40, issuedQty: 0 },
  ]).onConflictDoNothing();

  // 4. SCHEDULED — Kitui
  const [d4] = await db
    .insert(distributions)
    .values({
      ref: "KRD/2025/0119",
      title: "Kitui South — Mutomo food relief",
      countyId: cid("Kitui"),
      warehouseId: whRows[7].id,
      venue: "Mutomo market grounds",
      scheduledFor: daysAhead(9, 8),
      status: "SCHEDULED",
      createdById: admin.id,
      createdAt: daysAgo(1, 9),
    })
    .returning();
  await db.insert(distributionItems).values([
    { distributionId: d4.id, foodItemId: maize.id, plannedQty: 200, issuedQty: 0 },
    { distributionId: d4.id, foodItemId: grams.id, plannedQty: 120, issuedQty: 0 },
    { distributionId: d4.id, foodItemId: oil.id, plannedQty: 140, issuedQty: 0 },
  ]).onConflictDoNothing();

  // 5. COMPLETED — older Isiolo
  const [d5] = await db
    .insert(distributions)
    .values({
      ref: "KRD/2025/0094",
      title: "Isiolo — Merti & Sericho general relief",
      countyId: cid("Isiolo"),
      warehouseId: whRows[6].id,
      venue: "Merti Catholic mission",
      scheduledFor: daysAgo(48, 8),
      status: "COMPLETED",
      createdById: national.id,
      createdAt: daysAgo(55, 14),
      completedAt: daysAgo(48, 16),
    })
    .returning();
  await db.insert(distributionItems).values([
    { distributionId: d5.id, foodItemId: maize.id, plannedQty: 180, issuedQty: 176 },
    { distributionId: d5.id, foodItemId: oil.id, plannedQty: 120, issuedQty: 120 },
  ]).onConflictDoNothing();

  // 6. CANCELLED — Wajir (stock returned)
  const [d6] = await db
    .insert(distributions)
    .values({
      ref: "KRD/2025/0099",
      title: "Wajir East — Buna postponement exercise",
      countyId: cid("Wajir"),
      warehouseId: whRows[5].id,
      venue: "Buna trading centre",
      scheduledFor: daysAgo(30, 7),
      status: "CANCELLED",
      notes: "Cancelled after insecurity advisory; reserved stock returned to store.",
      createdById: national.id,
      createdAt: daysAgo(38, 10),
    })
    .returning();
  await db.insert(distributionItems).values([
    { distributionId: d6.id, foodItemId: maize.id, plannedQty: 90, issuedQty: 0 },
    { distributionId: d6.id, foodItemId: oil.id, plannedQty: 60, issuedQty: 0 },
  ]).onConflictDoNothing();

  console.log("Seeding notifications…");
  const notifRows: Array<typeof notifications.$inferInsert> = [];
  for (const b of turkanaBens) {
    if (!b.phone) continue;
    notifRows.push({
      distributionId: d1.id, beneficiaryId: b.id, phone: b.phone,
      message: `GoK Relief: Food distribution at Kalokol Primary School on ${d1.scheduledFor.toDateString()} from 8am. Bring your National ID.`,
      status: "SENT", providerRef: `KESIM${int(100000, 999999)}`, queuedAt: daysAgo(22, 16), sentAt: daysAgo(22, 15),
    });
  }
  for (const b of garissaBens) {
    if (!b.phone) continue;
    notifRows.push({
      distributionId: d2.id, beneficiaryId: b.id, phone: b.phone,
      message: `GoK Relief: Flood relief food issue at Sankuri distribution point. Bring your National ID. Exercise runs 2 days.`,
      status: "SENT", providerRef: `KESIM${int(100000, 999999)}`, queuedAt: daysAgo(2, 16), sentAt: daysAgo(2, 15),
    });
  }
  const marsabitBens = insertedBens.filter((b) => b.countyId === cid("Marsabit")).slice(0, 20);
  for (const b of marsabitBens) {
    if (!b.phone) continue;
    notifRows.push({
      distributionId: d3.id, beneficiaryId: b.id, phone: b.phone,
      message: `GoK Relief: Food distribution at North Horr chief's camp in 4 days from 7am. Bring your National ID.`,
      status: "QUEUED", queuedAt: daysAgo(1, 17),
    });
  }
  await db.insert(notifications).values(notifRows);

  console.log("Seeding audit trail…");
  await db.insert(auditLogs).values([
    { userId: admin.id, action: "USER_CREATED", entity: "user", entityId: String(national.id), detail: "Account provisioned for National Officer Daniel Kiprop", createdAt: daysAgo(90, 9) },
    { userId: warehouseMgr.id, action: "STOCK_INTAKE", entity: "warehouse", entityId: String(whRows[1].id), detail: "Received 640 × 90 kg bags dried beans at NCPB Nakuru Silos", createdAt: daysAgo(12, 10) },
    { userId: turkanaOfficer.id, action: "DISTRIBUTION_CREATED", entity: "distribution", entityId: String(d1.id), detail: "Turkana South — Kalokol drought response scheduled", createdAt: daysAgo(26, 10) },
    { userId: turkanaOfficer.id, action: "DISTRIBUTION_COMPLETED", entity: "distribution", entityId: String(d1.id), detail: "36 households served; records reconciled", createdAt: daysAgo(21, 15) },
    { userId: national.id, action: "DISTRIBUTION_CREATED", entity: "distribution", entityId: String(d2.id), detail: "Garissa West — Tana flood relief", createdAt: daysAgo(4, 11) },
    { userId: national.id, action: "DISTRIBUTION_CREATED", entity: "distribution", entityId: String(d3.id), detail: "Marsabit — North Horr & Moyale corridor", createdAt: daysAgo(2, 12) },
    { userId: turkanaOfficer.id, action: "BENEFICIARY_REGISTERED", entity: "beneficiary", entityId: String(insertedBens[0].id), detail: "Beneficiary registered & deduplicated by National ID", createdAt: daysAgo(1, 8) },
  ]);

  const [{ c: benCount }] = await db.select({ c: sql<number>`count(*)` }).from(beneficiaries);
  const [{ c: whCount }] = await db.select({ c: sql<number>`count(*)` }).from(warehouses);
  console.log(`Seed complete: ${benCount} beneficiaries, ${whCount} warehouses, 6 distributions.`);
  void eq; // keep import
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
