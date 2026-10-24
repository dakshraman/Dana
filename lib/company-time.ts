/**
 * Company business time: India Standard Time (Asia/Kolkata).
 *
 * India has a single fixed offset and no daylight saving, so the offset is
 * applied explicitly. That keeps server and client rendering identical and
 * avoids adding a timezone library just to shift a fixed number of minutes.
 */
export const COMPANY_TIME_ZONE = "Asia/Kolkata"
/** Short label shown next to rendered timestamps. */
export const COMPANY_TIME_LABEL = "IST"
export const COMPANY_TIME_OFFSET_MINUTES = 330
export const COMPANY_TIME_OFFSET_MS = COMPANY_TIME_OFFSET_MINUTES * 60 * 1000

export function shiftToCompanyTime(value: Date): Date {
  return new Date(value.getTime() + COMPANY_TIME_OFFSET_MS)
}

/**
 * UTC midnight of the company's calendar date. Use this for date-only columns
 * such as `DataRecord.recordDate`, which are stored as UTC midnight.
 */
export function companyDateOnly(value: Date): Date {
  const shifted = shiftToCompanyTime(value)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
  )
}

/** The instant at which the company's calendar day starts. */
export function companyDayStart(value: Date): Date {
  return new Date(companyDateOnly(value).getTime() - COMPANY_TIME_OFFSET_MS)
}

/** UTC midnight of the first day of the company's month (date-only). */
export function companyMonthStart(value: Date): Date {
  const shifted = shiftToCompanyTime(value)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1))
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000)
}
