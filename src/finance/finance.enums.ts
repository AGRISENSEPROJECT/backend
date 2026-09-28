export enum FinanceAccountType {
  BANK = 'BANK',
  CASH = 'CASH',
  MOBILE_MONEY = 'MOBILE_MONEY',
  PAYMENT_PLATFORM = 'PAYMENT_PLATFORM',
  OTHER = 'OTHER',
}

export enum FinanceCategoryKind {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum FinanceTransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum FinanceTransactionStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum FinanceAuditAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum FinanceAuditEntity {
  TRANSACTION = 'TRANSACTION',
  ACCOUNT = 'ACCOUNT',
  CATEGORY = 'CATEGORY',
}

export const FINANCE_CURRENCY = 'RWF';
