import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceAccount } from '../entities/finance-account.entity';
import { FinanceCategory } from '../entities/finance-category.entity';
import { FinanceTransaction } from '../entities/finance-transaction.entity';
import { FinanceAuditLog } from '../entities/finance-audit-log.entity';
import {
  CreateFinanceAccountDto,
  CreateFinanceCategoryDto,
  CreateFinanceTransactionDto,
  FinanceDecisionDto,
  UpdateFinanceAccountDto,
  UpdateFinanceCategoryDto,
  UpdateFinanceTransactionDto,
} from './dto/finance.dto';
import {
  FINANCE_CURRENCY,
  FinanceAccountType,
  FinanceAuditAction,
  FinanceAuditEntity,
  FinanceCategoryKind,
  FinanceTransactionStatus,
  FinanceTransactionType,
} from './finance.enums';

const EDITABLE_STATUSES = new Set([
  FinanceTransactionStatus.DRAFT,
  FinanceTransactionStatus.PENDING,
]);

const POSTED_STATUS = FinanceTransactionStatus.APPROVED;

type RangePreset = 'week' | 'month' | 'quarter' | 'year' | 'custom';

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseDate(value?: string, fallback?: Date) {
  if (!value) return fallback ?? new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return parsed;
}

export function resolveFinanceRange(preset?: string, from?: string, to?: string) {
  const now = new Date();
  const normalized = (preset || '').toLowerCase() as RangePreset;

  if (normalized === 'custom' || from || to) {
    const start = startOfDay(parseDate(from, new Date(now.getFullYear(), now.getMonth(), 1)));
    const end = endOfDay(parseDate(to, now));
    if (start > end) throw new BadRequestException('from must be before to');
    return { preset: 'custom' as const, from: start, to: end };
  }

  if (normalized === 'week') {
    const day = now.getDay() || 7;
    const start = startOfDay(new Date(now));
    start.setDate(now.getDate() - day + 1);
    return { preset: 'week' as const, from: start, to: endOfDay(now) };
  }

  if (normalized === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    const start = startOfDay(new Date(now.getFullYear(), quarter * 3, 1));
    return { preset: 'quarter' as const, from: start, to: endOfDay(now) };
  }

  if (normalized === 'year') {
    const start = startOfDay(new Date(now.getFullYear(), 0, 1));
    return { preset: 'year' as const, from: start, to: endOfDay(now) };
  }

  const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  return { preset: 'month' as const, from: start, to: endOfDay(now) };
}

const DEFAULT_ACCOUNTS: Array<{
  name: string;
  type: FinanceAccountType;
  institution?: string;
  description: string;
}> = [
  {
    name: 'Bank of Kigali',
    type: FinanceAccountType.BANK,
    institution: 'Bank of Kigali',
    description: 'Primary operating bank account',
  },
  {
    name: 'Cash on hand',
    type: FinanceAccountType.CASH,
    description: 'Physical cash held by the office',
  },
  {
    name: 'MTN Mobile Money',
    type: FinanceAccountType.MOBILE_MONEY,
    institution: 'MTN Rwanda',
    description: 'MoMo collections and payouts',
  },
  {
    name: 'Airtel Money',
    type: FinanceAccountType.MOBILE_MONEY,
    institution: 'Airtel Rwanda',
    description: 'Airtel Money collections and payouts',
  },
  {
    name: 'Flutterwave',
    type: FinanceAccountType.PAYMENT_PLATFORM,
    institution: 'Flutterwave',
    description: 'Card and mobile checkout settlement',
  },
];

const DEFAULT_CATEGORIES: Array<{
  name: string;
  kind: FinanceCategoryKind;
  color: string;
}> = [
  { name: 'Subscriptions', kind: FinanceCategoryKind.INCOME, color: '#0B6E4F' },
  { name: 'Marketplace', kind: FinanceCategoryKind.INCOME, color: '#1D4ED8' },
  { name: 'Grants', kind: FinanceCategoryKind.INCOME, color: '#7C3AED' },
  { name: 'Other income', kind: FinanceCategoryKind.INCOME, color: '#0F766E' },
  { name: 'Operations', kind: FinanceCategoryKind.EXPENSE, color: '#B45309' },
  { name: 'Payroll', kind: FinanceCategoryKind.EXPENSE, color: '#BE123C' },
  { name: 'Infrastructure', kind: FinanceCategoryKind.EXPENSE, color: '#334155' },
  { name: 'Marketing', kind: FinanceCategoryKind.EXPENSE, color: '#C2410C' },
  { name: 'Software', kind: FinanceCategoryKind.EXPENSE, color: '#0369A1' },
  { name: 'Other expenses', kind: FinanceCategoryKind.EXPENSE, color: '#57534E' },
];

@Injectable()
export class FinanceService {
  private defaultsReady = false;

  constructor(
    @InjectRepository(FinanceAccount)
    private readonly accounts: Repository<FinanceAccount>,
    @InjectRepository(FinanceCategory)
    private readonly categories: Repository<FinanceCategory>,
    @InjectRepository(FinanceTransaction)
    private readonly transactions: Repository<FinanceTransaction>,
    @InjectRepository(FinanceAuditLog)
    private readonly auditLogs: Repository<FinanceAuditLog>,
  ) {}

  async ensureDefaults() {
    if (this.defaultsReady) return;
    try {
      const accountCount = await this.accounts.count();
      if (accountCount === 0) {
        await this.accounts.save(
          DEFAULT_ACCOUNTS.map((item) =>
            this.accounts.create({
              ...item,
              currency: FINANCE_CURRENCY,
              createdById: null,
            }),
          ),
        );
      }

      const categoryCount = await this.categories.count();
      if (categoryCount === 0) {
        await this.categories.save(
          DEFAULT_CATEGORIES.map((item) =>
            this.categories.create({
              ...item,
              createdById: null,
            }),
          ),
        );
      }
      this.defaultsReady = true;
    } catch {
      // Tables may not exist yet during first production boot; retry on next request.
    }
  }

  private async writeAudit(
    action: FinanceAuditAction,
    entityType: FinanceAuditEntity,
    entityId: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.auditLogs.save(
      this.auditLogs.create({
        action,
        entityType,
        entityId,
        userId: userId || null,
        metadata: metadata || null,
      }),
    );
  }

  private toNumber(value: unknown) {
    const n = typeof value === 'string' ? Number(value) : Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private serializeTransaction(txn: FinanceTransaction) {
    return {
      id: txn.id,
      type: txn.type,
      status: txn.status,
      amount: txn.amount,
      currency: txn.currency || FINANCE_CURRENCY,
      occurredAt: txn.occurredAt,
      description: txn.description,
      notes: txn.notes,
      reference: txn.reference,
      counterparty: txn.counterparty,
      accountId: txn.accountId,
      categoryId: txn.categoryId,
      account: txn.account
        ? { id: txn.account.id, name: txn.account.name, type: txn.account.type }
        : undefined,
      category: txn.category
        ? { id: txn.category.id, name: txn.category.name, kind: txn.category.kind }
        : undefined,
      createdById: txn.createdById,
      createdBy: txn.createdBy
        ? {
            id: txn.createdBy.id,
            firstName: txn.createdBy.firstName,
            lastName: txn.createdBy.lastName,
            email: txn.createdBy.email,
          }
        : undefined,
      approvedById: txn.approvedById,
      approvedAt: txn.approvedAt,
      rejectedAt: txn.rejectedAt,
      rejectionReason: txn.rejectionReason,
      cancelledAt: txn.cancelledAt,
      cancelReason: txn.cancelReason,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
    };
  }

  async getAccountBalances(accountIds?: string[]) {
    const qb = this.transactions
      .createQueryBuilder('t')
      .select('t.accountId', 'accountId')
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.type = :income THEN t.amount ELSE 0 END), 0)`,
        'income',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.type = :expense THEN t.amount ELSE 0 END), 0)`,
        'expense',
      )
      .where('t.status = :status', {
        status: POSTED_STATUS,
        income: FinanceTransactionType.INCOME,
        expense: FinanceTransactionType.EXPENSE,
      })
      .groupBy('t.accountId');

    if (accountIds?.length) {
      qb.andWhere('t.accountId IN (:...accountIds)', { accountIds });
    }

    const rows = await qb.getRawMany<{ accountId: string; income: string; expense: string }>();
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.accountId, this.toNumber(row.income) - this.toNumber(row.expense));
    }
    return map;
  }

  async listAccounts() {
    await this.ensureDefaults();
    const rows = await this.accounts.find({ order: { name: 'ASC' } });
    const balances = await this.getAccountBalances(rows.map((row) => row.id));
    return {
      currency: FINANCE_CURRENCY,
      accounts: rows.map((row) => ({
        ...row,
        balance: balances.get(row.id) || 0,
      })),
    };
  }

  async createAccount(dto: CreateFinanceAccountDto, userId: string) {
    await this.ensureDefaults();
    const account = this.accounts.create({
      name: dto.name.trim(),
      type: dto.type,
      institution: dto.institution?.trim() || null,
      accountNumber: dto.accountNumber?.trim() || null,
      description: dto.description?.trim() || null,
      currency: FINANCE_CURRENCY,
      createdById: userId,
    });
    await this.accounts.save(account);
    await this.writeAudit(
      FinanceAuditAction.CREATED,
      FinanceAuditEntity.ACCOUNT,
      account.id,
      userId,
      { name: account.name, type: account.type },
    );
    return { ...account, balance: 0 };
  }

  async updateAccount(id: string, dto: UpdateFinanceAccountDto, userId: string) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');

    if (dto.name !== undefined) account.name = dto.name.trim();
    if (dto.type !== undefined) account.type = dto.type;
    if (dto.institution !== undefined) account.institution = dto.institution.trim() || null;
    if (dto.accountNumber !== undefined) account.accountNumber = dto.accountNumber.trim() || null;
    if (dto.description !== undefined) account.description = dto.description.trim() || null;
    if (dto.isActive !== undefined) account.isActive = dto.isActive;

    await this.accounts.save(account);
    await this.writeAudit(
      FinanceAuditAction.UPDATED,
      FinanceAuditEntity.ACCOUNT,
      account.id,
      userId,
      { name: account.name, isActive: account.isActive },
    );
    const balances = await this.getAccountBalances([account.id]);
    return { ...account, balance: balances.get(account.id) || 0 };
  }

  async listCategories(kind?: FinanceCategoryKind) {
    await this.ensureDefaults();
    const where = kind ? { kind } : {};
    const rows = await this.categories.find({
      where,
      order: { kind: 'ASC', name: 'ASC' },
    });
    return { categories: rows };
  }

  async createCategory(dto: CreateFinanceCategoryDto, userId: string) {
    await this.ensureDefaults();
    const existing = await this.categories.findOne({
      where: { name: dto.name.trim(), kind: dto.kind },
    });
    if (existing) {
      throw new BadRequestException('A category with this name and type already exists');
    }
    const category = this.categories.create({
      name: dto.name.trim(),
      kind: dto.kind,
      description: dto.description?.trim() || null,
      color: dto.color?.trim() || null,
      createdById: userId,
    });
    await this.categories.save(category);
    await this.writeAudit(
      FinanceAuditAction.CREATED,
      FinanceAuditEntity.CATEGORY,
      category.id,
      userId,
      { name: category.name, kind: category.kind },
    );
    return category;
  }

  async updateCategory(id: string, dto: UpdateFinanceCategoryDto, userId: string) {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.kind !== undefined) category.kind = dto.kind;
    if (dto.description !== undefined) category.description = dto.description.trim() || null;
    if (dto.color !== undefined) category.color = dto.color.trim() || null;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;

    try {
      await this.categories.save(category);
    } catch {
      throw new BadRequestException('A category with this name and type already exists');
    }
    await this.writeAudit(
      FinanceAuditAction.UPDATED,
      FinanceAuditEntity.CATEGORY,
      category.id,
      userId,
      { name: category.name, isActive: category.isActive },
    );
    return category;
  }

  private async getActiveAccount(id: string) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    if (!account.isActive) throw new BadRequestException('Account is archived');
    return account;
  }

  private async getActiveCategory(id: string, type?: FinanceTransactionType) {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    if (!category.isActive) throw new BadRequestException('Category is archived');
    if (type && category.kind !== type) {
      throw new BadRequestException('Category type must match the transaction type');
    }
    return category;
  }

  private defaultStatus(type: FinanceTransactionType, status?: FinanceTransactionStatus) {
    if (status) {
      if (
        status === FinanceTransactionStatus.REJECTED ||
        status === FinanceTransactionStatus.CANCELLED
      ) {
        throw new BadRequestException('Cannot create a rejected or cancelled transaction');
      }
      return status;
    }
    return type === FinanceTransactionType.INCOME
      ? FinanceTransactionStatus.APPROVED
      : FinanceTransactionStatus.PENDING;
  }

  async listTransactions(params: {
    page?: number;
    limit?: number;
    type?: FinanceTransactionType;
    status?: FinanceTransactionStatus;
    accountId?: string;
    categoryId?: string;
    search?: string;
    from?: string;
    to?: string;
    preset?: string;
  }) {
    await this.ensureDefaults();
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const range = resolveFinanceRange(params.preset, params.from, params.to);

    const qb = this.transactions
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.account', 'account')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.createdBy', 'createdBy')
      .where('t.occurredAt BETWEEN :from AND :to', { from: range.from, to: range.to })
      .orderBy('t.occurredAt', 'DESC')
      .addOrderBy('t.createdAt', 'DESC');

    if (params.type) qb.andWhere('t.type = :type', { type: params.type });
    if (params.status) qb.andWhere('t.status = :status', { status: params.status });
    if (params.accountId) qb.andWhere('t.accountId = :accountId', { accountId: params.accountId });
    if (params.categoryId) {
      qb.andWhere('t.categoryId = :categoryId', { categoryId: params.categoryId });
    }
    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(t.description) LIKE :search OR LOWER(COALESCE(t.reference, '')) LIKE :search OR LOWER(COALESCE(t.counterparty, '')) LIKE :search)`,
        { search },
      );
    }

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      transactions: rows.map((row) => this.serializeTransaction(row)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      range: { preset: range.preset, from: range.from, to: range.to },
    };
  }

  async getTransaction(id: string) {
    const txn = await this.transactions.findOne({
      where: { id },
      relations: ['account', 'category', 'createdBy', 'approvedBy'],
    });
    if (!txn) throw new NotFoundException('Transaction not found');
    return this.serializeTransaction(txn);
  }

  async createTransaction(dto: CreateFinanceTransactionDto, userId: string) {
    await this.ensureDefaults();
    await this.getActiveAccount(dto.accountId);
    await this.getActiveCategory(dto.categoryId, dto.type);
    const status = this.defaultStatus(dto.type, dto.status);
    const now = new Date();

    const txn = this.transactions.create({
      type: dto.type,
      status,
      amount: dto.amount,
      currency: FINANCE_CURRENCY,
      occurredAt: parseDate(dto.occurredAt),
      description: dto.description.trim(),
      notes: dto.notes?.trim() || null,
      reference: dto.reference?.trim() || null,
      counterparty: dto.counterparty?.trim() || null,
      accountId: dto.accountId,
      categoryId: dto.categoryId,
      createdById: userId,
      approvedById: status === FinanceTransactionStatus.APPROVED ? userId : null,
      approvedAt: status === FinanceTransactionStatus.APPROVED ? now : null,
    });
    await this.transactions.save(txn);
    await this.writeAudit(
      status === FinanceTransactionStatus.APPROVED
        ? FinanceAuditAction.APPROVED
        : FinanceAuditAction.CREATED,
      FinanceAuditEntity.TRANSACTION,
      txn.id,
      userId,
      { type: txn.type, amount: txn.amount, status },
    );
    return this.getTransaction(txn.id);
  }

  async updateTransaction(id: string, dto: UpdateFinanceTransactionDto, userId: string) {
    const txn = await this.transactions.findOne({ where: { id } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (!EDITABLE_STATUSES.has(txn.status as FinanceTransactionStatus)) {
      throw new BadRequestException('Only draft or pending transactions can be edited');
    }

    const nextType = dto.type || (txn.type as FinanceTransactionType);
    if (dto.accountId) await this.getActiveAccount(dto.accountId);
    if (dto.categoryId || dto.type) {
      await this.getActiveCategory(dto.categoryId || txn.categoryId, nextType);
    }

    if (dto.type !== undefined) txn.type = dto.type;
    if (dto.amount !== undefined) txn.amount = dto.amount;
    if (dto.occurredAt !== undefined) txn.occurredAt = parseDate(dto.occurredAt);
    if (dto.description !== undefined) txn.description = dto.description.trim();
    if (dto.notes !== undefined) txn.notes = dto.notes.trim() || null;
    if (dto.reference !== undefined) txn.reference = dto.reference.trim() || null;
    if (dto.counterparty !== undefined) txn.counterparty = dto.counterparty.trim() || null;
    if (dto.accountId !== undefined) txn.accountId = dto.accountId;
    if (dto.categoryId !== undefined) txn.categoryId = dto.categoryId;

    await this.transactions.save(txn);
    await this.writeAudit(
      FinanceAuditAction.UPDATED,
      FinanceAuditEntity.TRANSACTION,
      txn.id,
      userId,
      { type: txn.type, amount: txn.amount, status: txn.status },
    );
    return this.getTransaction(txn.id);
  }

  async approveTransaction(id: string, userId: string) {
    const txn = await this.transactions.findOne({ where: { id } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status !== FinanceTransactionStatus.PENDING) {
      throw new BadRequestException('Only pending transactions can be approved');
    }
    txn.status = FinanceTransactionStatus.APPROVED;
    txn.approvedById = userId;
    txn.approvedAt = new Date();
    txn.rejectedById = null;
    txn.rejectedAt = null;
    txn.rejectionReason = null;
    await this.transactions.save(txn);
    await this.writeAudit(
      FinanceAuditAction.APPROVED,
      FinanceAuditEntity.TRANSACTION,
      txn.id,
      userId,
      { amount: txn.amount, type: txn.type },
    );
    return this.getTransaction(txn.id);
  }

  async rejectTransaction(id: string, userId: string, dto: FinanceDecisionDto = {}) {
    const txn = await this.transactions.findOne({ where: { id } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status !== FinanceTransactionStatus.PENDING) {
      throw new BadRequestException('Only pending transactions can be rejected');
    }
    txn.status = FinanceTransactionStatus.REJECTED;
    txn.rejectedById = userId;
    txn.rejectedAt = new Date();
    txn.rejectionReason = dto.reason?.trim() || null;
    await this.transactions.save(txn);
    await this.writeAudit(
      FinanceAuditAction.REJECTED,
      FinanceAuditEntity.TRANSACTION,
      txn.id,
      userId,
      { amount: txn.amount, type: txn.type, reason: txn.rejectionReason },
    );
    return this.getTransaction(txn.id);
  }

  async cancelTransaction(id: string, userId: string, dto: FinanceDecisionDto = {}) {
    const txn = await this.transactions.findOne({ where: { id } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (
      txn.status !== FinanceTransactionStatus.PENDING &&
      txn.status !== FinanceTransactionStatus.APPROVED
    ) {
      throw new BadRequestException('Only pending or approved transactions can be cancelled');
    }
    txn.status = FinanceTransactionStatus.CANCELLED;
    txn.cancelledById = userId;
    txn.cancelledAt = new Date();
    txn.cancelReason = dto.reason?.trim() || null;
    await this.transactions.save(txn);
    await this.writeAudit(
      FinanceAuditAction.CANCELLED,
      FinanceAuditEntity.TRANSACTION,
      txn.id,
      userId,
      { amount: txn.amount, type: txn.type, reason: txn.cancelReason },
    );
    return this.getTransaction(txn.id);
  }

  async getDashboard(preset?: string, from?: string, to?: string) {
    await this.ensureDefaults();
    const range = resolveFinanceRange(preset, from, to);
    const posted = FinanceTransactionStatus.APPROVED;

    const [lifetime, period, pending, recent, trend, breakdown, accounts] = await Promise.all([
      this.transactions
        .createQueryBuilder('t')
        .select(
          `COALESCE(SUM(CASE WHEN t.type = :income THEN t.amount ELSE 0 END), 0)`,
          'income',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN t.type = :expense THEN t.amount ELSE 0 END), 0)`,
          'expense',
        )
        .where('t.status = :status', {
          status: posted,
          income: FinanceTransactionType.INCOME,
          expense: FinanceTransactionType.EXPENSE,
        })
        .getRawOne<{ income: string; expense: string }>(),
      this.transactions
        .createQueryBuilder('t')
        .select(
          `COALESCE(SUM(CASE WHEN t.type = :income THEN t.amount ELSE 0 END), 0)`,
          'income',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN t.type = :expense THEN t.amount ELSE 0 END), 0)`,
          'expense',
        )
        .where('t.status = :status', {
          status: posted,
          income: FinanceTransactionType.INCOME,
          expense: FinanceTransactionType.EXPENSE,
        })
        .andWhere('t.occurredAt BETWEEN :from AND :to', { from: range.from, to: range.to })
        .getRawOne<{ income: string; expense: string }>(),
      this.transactions
        .createQueryBuilder('t')
        .select('COALESCE(SUM(t.amount), 0)', 'amount')
        .addSelect('COUNT(*)', 'count')
        .where('t.type = :type', { type: FinanceTransactionType.EXPENSE })
        .andWhere('t.status = :status', { status: FinanceTransactionStatus.PENDING })
        .getRawOne<{ amount: string; count: string }>(),
      this.transactions.find({
        where: {},
        relations: ['account', 'category', 'createdBy'],
        order: { occurredAt: 'DESC', createdAt: 'DESC' },
        take: 8,
      }),
      this.transactions
        .createQueryBuilder('t')
        .select(`to_char(date_trunc('month', t.occurredAt), 'YYYY-MM')`, 'period')
        .addSelect(
          `COALESCE(SUM(CASE WHEN t.type = :income THEN t.amount ELSE 0 END), 0)`,
          'income',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN t.type = :expense THEN t.amount ELSE 0 END), 0)`,
          'expense',
        )
        .where('t.status = :status', {
          status: posted,
          income: FinanceTransactionType.INCOME,
          expense: FinanceTransactionType.EXPENSE,
        })
        .andWhere('t.occurredAt BETWEEN :from AND :to', { from: range.from, to: range.to })
        .groupBy(`date_trunc('month', t.occurredAt)`)
        .orderBy(`date_trunc('month', t.occurredAt)`, 'ASC')
        .getRawMany<{ period: string; income: string; expense: string }>(),
      this.transactions
        .createQueryBuilder('t')
        .innerJoin('t.category', 'c')
        .select('c.id', 'categoryId')
        .addSelect('c.name', 'name')
        .addSelect('c.color', 'color')
        .addSelect('COALESCE(SUM(t.amount), 0)', 'amount')
        .where('t.status = :status', { status: posted })
        .andWhere('t.type = :type', { type: FinanceTransactionType.EXPENSE })
        .andWhere('t.occurredAt BETWEEN :from AND :to', { from: range.from, to: range.to })
        .groupBy('c.id')
        .addGroupBy('c.name')
        .addGroupBy('c.color')
        .orderBy('amount', 'DESC')
        .getRawMany<{ categoryId: string; name: string; color: string; amount: string }>(),
      this.listAccounts(),
    ]);

    const lifetimeIncome = this.toNumber(lifetime?.income);
    const lifetimeExpense = this.toNumber(lifetime?.expense);
    const periodIncome = this.toNumber(period?.income);
    const periodExpense = this.toNumber(period?.expense);

    return {
      currency: FINANCE_CURRENCY,
      range: { preset: range.preset, from: range.from, to: range.to },
      totals: {
        currentBalance: lifetimeIncome - lifetimeExpense,
        totalIncome: periodIncome,
        totalExpenses: periodExpense,
        netCashFlow: periodIncome - periodExpense,
        pendingExpenses: this.toNumber(pending?.amount),
        pendingExpenseCount: this.toNumber(pending?.count),
      },
      accounts: accounts.accounts.filter((row) => row.isActive),
      recentTransactions: recent.map((row) => this.serializeTransaction(row)),
      incomeVsExpenses: trend.map((row) => ({
        period: row.period,
        income: this.toNumber(row.income),
        expenses: this.toNumber(row.expense),
        net: this.toNumber(row.income) - this.toNumber(row.expense),
      })),
      expensesByCategory: breakdown.map((row) => ({
        categoryId: row.categoryId,
        name: row.name,
        color: row.color,
        amount: this.toNumber(row.amount),
      })),
    };
  }

  async getReport(params: {
    kind?: string;
    preset?: string;
    from?: string;
    to?: string;
    accountId?: string;
    categoryId?: string;
  }) {
    await this.ensureDefaults();
    const range = resolveFinanceRange(params.preset, params.from, params.to);
    const kind = (params.kind || 'transactions').toLowerCase();
    const qb = this.transactions
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.account', 'account')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.createdBy', 'createdBy')
      .where('t.occurredAt BETWEEN :from AND :to', { from: range.from, to: range.to })
      .orderBy('t.occurredAt', 'DESC');

    if (params.accountId) qb.andWhere('t.accountId = :accountId', { accountId: params.accountId });
    if (params.categoryId) {
      qb.andWhere('t.categoryId = :categoryId', { categoryId: params.categoryId });
    }

    if (kind === 'income') {
      qb.andWhere('t.type = :type', { type: FinanceTransactionType.INCOME });
      qb.andWhere('t.status = :status', { status: POSTED_STATUS });
    } else if (kind === 'expense' || kind === 'expenses') {
      qb.andWhere('t.type = :type', { type: FinanceTransactionType.EXPENSE });
      qb.andWhere('t.status = :status', { status: POSTED_STATUS });
    } else if (kind === 'cash-flow' || kind === 'cashflow') {
      qb.andWhere('t.status = :status', { status: POSTED_STATUS });
    } else if (kind === 'category' || kind === 'expense-by-category') {
      qb.andWhere('t.type = :type', { type: FinanceTransactionType.EXPENSE });
      qb.andWhere('t.status = :status', { status: POSTED_STATUS });
    }

    const rows = await qb.getMany();
    const serialized = rows.map((row) => this.serializeTransaction(row));
    const income = serialized
      .filter((row) => row.type === FinanceTransactionType.INCOME && row.status === POSTED_STATUS)
      .reduce((sum, row) => sum + row.amount, 0);
    const expenses = serialized
      .filter((row) => row.type === FinanceTransactionType.EXPENSE && row.status === POSTED_STATUS)
      .reduce((sum, row) => sum + row.amount, 0);

    const byCategory = new Map<string, { name: string; amount: number }>();
    for (const row of serialized) {
      if (row.type !== FinanceTransactionType.EXPENSE || row.status !== POSTED_STATUS) continue;
      const key = row.categoryId;
      const current = byCategory.get(key) || { name: row.category?.name || 'Uncategorized', amount: 0 };
      current.amount += row.amount;
      byCategory.set(key, current);
    }

    return {
      kind,
      currency: FINANCE_CURRENCY,
      range: { preset: range.preset, from: range.from, to: range.to },
      summary: {
        income,
        expenses,
        net: income - expenses,
        count: serialized.length,
      },
      expensesByCategory: Array.from(byCategory.entries()).map(([categoryId, value]) => ({
        categoryId,
        ...value,
      })),
      rows: serialized,
    };
  }

  async listAudit(params: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const qb = this.auditLogs
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'user')
      .orderBy('a.createdAt', 'DESC');

    if (params.action) qb.andWhere('a.action = :action', { action: params.action.toUpperCase() });
    if (params.entityType) {
      qb.andWhere('a.entityType = :entityType', { entityType: params.entityType.toUpperCase() });
    }

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      logs: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        userId: row.userId,
        user: row.user
          ? {
              id: row.user.id,
              firstName: row.user.firstName,
              lastName: row.user.lastName,
              email: row.user.email,
            }
          : null,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
