// Account types whose balance counts as debt (mirrors DEBT_TYPES in the web repo's lib/account-types.ts)
export const DEBT_TYPES = new Set([
    'CREDIT_CARD', 'LINE_OF_CREDIT', 'MORTGAGE',
    'AUTO_LOAN', 'STUDENT_LOAN', 'PERSONAL_LOAN', 'LOAN',
])
