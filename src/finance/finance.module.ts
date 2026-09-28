import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceAccount } from '../entities/finance-account.entity';
import { FinanceCategory } from '../entities/finance-category.entity';
import { FinanceTransaction } from '../entities/finance-transaction.entity';
import { FinanceAuditLog } from '../entities/finance-audit-log.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceAccount,
      FinanceCategory,
      FinanceTransaction,
      FinanceAuditLog,
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
