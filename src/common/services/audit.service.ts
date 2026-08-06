import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(
    action: AuditAction,
    userId?: string,
    email?: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
  ) {
    const entry = this.auditRepository.create({
      action,
      userId,
      email,
      metadata,
      ipAddress,
    });
    await this.auditRepository.save(entry);
  }
}
