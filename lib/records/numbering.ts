import type { Prisma } from "@/lib/generated/prisma/client"

/**
 * Allocate the next sequential record number for a branch and year.
 *
 * The upsert is a single atomic statement against the (branchId, year) unique
 * key, so concurrent submissions cannot receive the same number. This must be
 * called inside the same transaction that creates the record: if the insert
 * fails the counter increment is rolled back with it.
 */
export async function nextRecordNumber(
  tx: Prisma.TransactionClient,
  branchId: string,
  branchCode: string,
  recordDate: Date
): Promise<string> {
  const year = recordDate.getUTCFullYear()

  const counter = await tx.recordCounter.upsert({
    where: { branchId_year: { branchId, year } },
    create: { branchId, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  })

  return `${branchCode}-${year}-${String(counter.lastNumber).padStart(5, "0")}`
}
