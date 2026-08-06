import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from './guards/roles.guard';
import { AuditService } from './services/audit.service';
import { AuditLog } from '../entities/audit-log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [RolesGuard, AuditService],
  exports: [RolesGuard, AuditService],
})
export class CommonModule {}
