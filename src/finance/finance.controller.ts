import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { FinanceService } from './finance.service';
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
  FinanceAuditAction,
  FinanceAuditEntity,
  FinanceCategoryKind,
  FinanceTransactionStatus,
  FinanceTransactionType,
} from './finance.enums';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CFO, UserRole.ADMIN)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  private actorId(req: Request) {
    return (req.user as { id: string }).id;
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'CFO dashboard totals, trends, and recent activity' })
  @ApiQuery({ name: 'preset', required: false, enum: ['week', 'month', 'quarter', 'year', 'custom'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getDashboard(
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.financeService.getDashboard(preset, from, to);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List finance accounts with derived balances' })
  listAccounts() {
    return this.financeService.listAccounts();
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Create a finance account' })
  createAccount(@Req() req: Request, @Body() dto: CreateFinanceAccountDto) {
    return this.financeService.createAccount(dto, this.actorId(req));
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Update or archive a finance account' })
  updateAccount(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateFinanceAccountDto,
  ) {
    return this.financeService.updateAccount(id, dto, this.actorId(req));
  }

  @Get('categories')
  @ApiOperation({ summary: 'List income and expense categories' })
  @ApiQuery({ name: 'kind', required: false, enum: FinanceCategoryKind })
  listCategories(@Query('kind') kind?: FinanceCategoryKind) {
    return this.financeService.listCategories(kind);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a finance category' })
  createCategory(@Req() req: Request, @Body() dto: CreateFinanceCategoryDto) {
    return this.financeService.createCategory(dto, this.actorId(req));
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update or archive a finance category' })
  updateCategory(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateFinanceCategoryDto,
  ) {
    return this.financeService.updateCategory(id, dto, this.actorId(req));
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Search and filter finance transactions' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'type', required: false, enum: FinanceTransactionType })
  @ApiQuery({ name: 'status', required: false, enum: FinanceTransactionStatus })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'preset', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listTransactions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: FinanceTransactionType,
    @Query('status') status?: FinanceTransactionStatus,
    @Query('accountId') accountId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.financeService.listTransactions({
      page,
      limit,
      type,
      status,
      accountId,
      categoryId,
      search,
      preset,
      from,
      to,
    });
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get one finance transaction' })
  getTransaction(@Param('id') id: string) {
    return this.financeService.getTransaction(id);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Create an income or expense transaction' })
  createTransaction(@Req() req: Request, @Body() dto: CreateFinanceTransactionDto) {
    return this.financeService.createTransaction(dto, this.actorId(req));
  }

  @Patch('transactions/:id')
  @ApiOperation({ summary: 'Edit a draft or pending transaction' })
  updateTransaction(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateFinanceTransactionDto,
  ) {
    return this.financeService.updateTransaction(id, dto, this.actorId(req));
  }

  @Post('transactions/:id/approve')
  @ApiOperation({ summary: 'Approve a pending transaction' })
  approveTransaction(@Req() req: Request, @Param('id') id: string) {
    return this.financeService.approveTransaction(id, this.actorId(req));
  }

  @Post('transactions/:id/reject')
  @ApiOperation({ summary: 'Reject a pending transaction' })
  rejectTransaction(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: FinanceDecisionDto,
  ) {
    return this.financeService.rejectTransaction(id, this.actorId(req), dto);
  }

  @Post('transactions/:id/cancel')
  @ApiOperation({ summary: 'Cancel (void) a pending or approved transaction' })
  cancelTransaction(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: FinanceDecisionDto,
  ) {
    return this.financeService.cancelTransaction(id, this.actorId(req), dto);
  }

  @Get('reports')
  @ApiOperation({
    summary: 'Income, expense, cash-flow, category, or transaction report',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['income', 'expense', 'cash-flow', 'expense-by-category', 'transactions'],
  })
  @ApiQuery({ name: 'preset', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  getReport(
    @Query('kind') kind?: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('accountId') accountId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.financeService.getReport({ kind, preset, from, to, accountId, categoryId });
  }

  @Get('audit')
  @ApiOperation({ summary: 'Finance audit trail' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'action', required: false, enum: FinanceAuditAction })
  @ApiQuery({ name: 'entityType', required: false, enum: FinanceAuditEntity })
  listAudit(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.financeService.listAudit({ page, limit, action, entityType });
  }
}
