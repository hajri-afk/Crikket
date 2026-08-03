/**
 * Scope of the QA session attached to a bug report, so developers and PMs can
 * tell what was actually exercised before the bug was filed.
 */
export const TEST_CASE_TYPE_OPTIONS = {
  positive: "positive",
  negative: "negative",
  both: "both",
} as const

export type TestCaseType =
  (typeof TEST_CASE_TYPE_OPTIONS)[keyof typeof TEST_CASE_TYPE_OPTIONS]

export const TEST_CASE_TYPE_VALUES = Object.values(TEST_CASE_TYPE_OPTIONS) as [
  TestCaseType,
  ...TestCaseType[],
]

export const TEST_SCENARIO_MAX_LENGTH = 3000

/** Feature or menu the QA session exercised, e.g. "Registrasi > Buka Rekening". */
export const TESTED_FEATURE_MAX_LENGTH = 120

export const TESTED_FEATURE_PLACEHOLDER = "Registrasi > Buka Rekening Baru"

/**
 * Written around the menus and buttons QA actually clicked, so developers and
 * PMs read concrete steps instead of abstract case labels.
 */
export const TEST_SCENARIO_PLACEHOLDER = `Menu: Registrasi > Buka Rekening Baru
- Klik Lanjut setelah isi data diri -> masuk ke langkah verifikasi
- Klik Lanjut tanpa isi NIK -> muncul pesan "NIK wajib diisi"
- Klik Kembali di langkah 2 -> data sebelumnya tetap tersimpan`

export function isTestCaseType(value: unknown): value is TestCaseType {
  return (
    typeof value === "string" &&
    (TEST_CASE_TYPE_VALUES as readonly string[]).includes(value)
  )
}

export function formatTestCaseTypeLabel(value: TestCaseType): string {
  if (value === TEST_CASE_TYPE_OPTIONS.positive) {
    return "Positive case"
  }

  if (value === TEST_CASE_TYPE_OPTIONS.negative) {
    return "Negative case"
  }

  return "Positive & negative"
}
