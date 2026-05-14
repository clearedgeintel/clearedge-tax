import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.auditEvent.deleteMany();
  await prisma.reviewAction.deleteMany();
  await prisma.deadline.deleteMany();
  await prisma.document.deleteMany();
  await prisma.triggeredForm.deleteMany();
  await prisma.interviewResponse.deleteMany();
  await prisma.k1Link.deleteMany();
  await prisma.taxReturn.deleteMany();
  await prisma.entityRelationship.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.client.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.firm.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);
  const timPasswordHash = await bcrypt.hash("123456", 10);

  // Create firm
  const firm = await prisma.firm.create({
    data: {
      name: "ClearEdge Tax Partners",
      ein: "12-3456789",
      address: {
        street: "100 Main Street",
        city: "Austin",
        state: "TX",
        zip: "78701",
      },
      phone: "(512) 555-0100",
    },
  });
  console.log("  Created firm:", firm.name);

  // Create users (one per role)
  // Tim Hull - primary admin
  const tim = await prisma.user.create({
    data: {
      email: "tim.hull@clearedgeintel.com",
      name: "Tim Hull",
      passwordHash: timPasswordHash,
      role: "ADMIN",
      firmId: firm.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@clearedgetax.com",
      name: "Sarah Admin",
      passwordHash,
      role: "ADMIN",
      firmId: firm.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@clearedgetax.com",
      name: "Mike Manager",
      passwordHash,
      role: "MANAGER",
      firmId: firm.id,
    },
  });

  const preparer = await prisma.user.create({
    data: {
      email: "preparer@clearedgetax.com",
      name: "Pat Preparer",
      passwordHash,
      role: "PREPARER",
      firmId: firm.id,
    },
  });

  const clientUser = await prisma.user.create({
    data: {
      email: "john@example.com",
      name: "John Smith",
      passwordHash,
      role: "CLIENT",
    },
  });

  console.log("  Created 4 users (admin, manager, preparer, client)");

  // Create a sample client household
  const client = await prisma.client.create({
    data: {
      firmId: firm.id,
      userId: clientUser.id,
      displayName: "John & Jane Smith",
      email: "john@example.com",
      phone: "(512) 555-0200",
    },
  });
  console.log("  Created client:", client.displayName);

  // Create entities for the household
  const john = await prisma.entity.create({
    data: {
      clientId: client.id,
      entityType: "INDIVIDUAL_1040",
      legalName: "John Smith",
      tinType: "SSN",
      filingStatus: "MFJ",
      dateOfBirth: new Date("1985-03-15"),
      address: {
        street: "456 Oak Drive",
        city: "Austin",
        state: "TX",
        zip: "78702",
      },
    },
  });

  const jane = await prisma.entity.create({
    data: {
      clientId: client.id,
      entityType: "INDIVIDUAL_1040",
      legalName: "Jane Smith",
      tinType: "SSN",
      filingStatus: "MFJ",
      dateOfBirth: new Date("1987-07-22"),
      address: {
        street: "456 Oak Drive",
        city: "Austin",
        state: "TX",
        zip: "78702",
      },
    },
  });

  // John's S-Corp
  const sCorp = await prisma.entity.create({
    data: {
      clientId: client.id,
      entityType: "S_CORP_1120S",
      legalName: "Smith Consulting LLC",
      tinType: "EIN",
      stateOfFormation: "TX",
      dateOfFormation: new Date("2020-01-15"),
      metadata: {
        naicsCode: "541611",
        fiscalYearEnd: "12-31",
        accountingMethod: "cash",
      },
    },
  });

  // Jane's sole prop
  const soleProp = await prisma.entity.create({
    data: {
      clientId: client.id,
      entityType: "SOLE_PROP_SCHEDULE_C",
      legalName: "Jane Smith Photography",
      tinType: "SSN",
      metadata: {
        naicsCode: "541921",
        accountingMethod: "cash",
      },
    },
  });

  // Dependents
  const child1 = await prisma.entity.create({
    data: {
      clientId: client.id,
      entityType: "INDIVIDUAL_1040",
      legalName: "Emma Smith",
      tinType: "SSN",
      dateOfBirth: new Date("2015-09-10"),
    },
  });

  const child2 = await prisma.entity.create({
    data: {
      clientId: client.id,
      entityType: "INDIVIDUAL_1040",
      legalName: "Liam Smith",
      tinType: "SSN",
      dateOfBirth: new Date("2018-02-28"),
    },
  });

  console.log("  Created 6 entities (2 adults, 2 children, S-Corp, sole prop)");

  // Create relationships
  await prisma.entityRelationship.createMany({
    data: [
      // Spousal relationship
      {
        fromEntityId: john.id,
        toEntityId: jane.id,
        relationshipType: "SPOUSE",
      },
      // Dependents
      {
        fromEntityId: child1.id,
        toEntityId: john.id,
        relationshipType: "DEPENDENT",
      },
      {
        fromEntityId: child2.id,
        toEntityId: john.id,
        relationshipType: "DEPENDENT",
      },
      // John is 100% shareholder of S-Corp
      {
        fromEntityId: john.id,
        toEntityId: sCorp.id,
        relationshipType: "SHAREHOLDER",
        ownershipPct: 100,
      },
      // John is officer of S-Corp
      {
        fromEntityId: john.id,
        toEntityId: sCorp.id,
        relationshipType: "OFFICER",
      },
      // Sole prop belongs to Jane
      {
        fromEntityId: soleProp.id,
        toEntityId: jane.id,
        relationshipType: "PARENT_ENTITY",
      },
      // Household members
      {
        fromEntityId: john.id,
        toEntityId: jane.id,
        relationshipType: "HOUSEHOLD_MEMBER",
      },
    ],
  });
  console.log("  Created 7 entity relationships");

  // Create tax returns for 2025
  const taxYear = 2025;

  const sCorpReturn = await prisma.taxReturn.create({
    data: {
      entityId: sCorp.id,
      taxYear,
      status: "INTAKE",
      preparerId: preparer.id,
      reviewerId: manager.id,
      filingJurisdictions: ["FEDERAL", "TX"],
    },
  });

  const johnReturn = await prisma.taxReturn.create({
    data: {
      entityId: john.id,
      taxYear,
      status: "INTAKE",
      preparerId: preparer.id,
      reviewerId: manager.id,
      filingJurisdictions: ["FEDERAL", "TX"],
    },
  });

  console.log("  Created 2 tax returns (S-Corp and individual)");

  // Create K-1 link: S-Corp return -> John's 1040
  await prisma.k1Link.create({
    data: {
      sourceReturnId: sCorpReturn.id,
      targetReturnId: johnReturn.id,
      issuingEntityId: sCorp.id,
      recipientEntityId: john.id,
      ownershipPct: 100,
    },
  });
  console.log("  Created K-1 link (S-Corp -> John's 1040)");

  // Create deadlines for both returns
  const sCorpDeadlines = [
    {
      returnId: sCorpReturn.id,
      deadlineType: "FILING" as const,
      jurisdiction: "FEDERAL",
      dueDate: new Date(`${taxYear + 1}-03-16`), // March 15 falls on Saturday in 2026
      originalDueDate: new Date(`${taxYear + 1}-03-15`),
      warningDays: 30,
    },
  ];

  const individualDeadlines = [
    {
      returnId: johnReturn.id,
      deadlineType: "FILING" as const,
      jurisdiction: "FEDERAL",
      dueDate: new Date(`${taxYear + 1}-04-15`),
      originalDueDate: new Date(`${taxYear + 1}-04-15`),
      warningDays: 30,
    },
    {
      returnId: johnReturn.id,
      deadlineType: "ESTIMATED_Q1" as const,
      jurisdiction: "FEDERAL",
      dueDate: new Date(`${taxYear + 1}-04-15`),
      originalDueDate: new Date(`${taxYear + 1}-04-15`),
      warningDays: 14,
    },
  ];

  await prisma.deadline.createMany({
    data: [...sCorpDeadlines, ...individualDeadlines],
  });
  console.log("  Created 3 deadlines");

  // Create a sample nonprofit client
  const npClient = await prisma.client.create({
    data: {
      firmId: firm.id,
      displayName: "Austin Community Foundation",
      email: "info@austincf.org",
    },
  });

  const nonprofit = await prisma.entity.create({
    data: {
      clientId: npClient.id,
      entityType: "NONPROFIT_990",
      legalName: "Austin Community Foundation",
      tinType: "EIN",
      stateOfFormation: "TX",
      dateOfFormation: new Date("2005-06-01"),
      metadata: {
        exemptionType: "501(c)(3)",
        fiscalYearEnd: "12-31",
      },
    },
  });

  await prisma.taxReturn.create({
    data: {
      entityId: nonprofit.id,
      taxYear,
      status: "INTAKE",
      preparerId: preparer.id,
      reviewerId: manager.id,
      filingJurisdictions: ["FEDERAL", "TX"],
    },
  });
  console.log("  Created nonprofit client with 990 return");

  console.log("\nSeed complete!");
  console.log("\nTest accounts:");
  console.log("  tim.hull@clearedgeintel.com / 123456       (ADMIN)");
  console.log("  admin@clearedgetax.com      / password123  (ADMIN)");
  console.log("  manager@clearedgetax.com    / password123  (MANAGER)");
  console.log("  preparer@clearedgetax.com   / password123  (PREPARER)");
  console.log("  john@example.com            / password123  (CLIENT)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
