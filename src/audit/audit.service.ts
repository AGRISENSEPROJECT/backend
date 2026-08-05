import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export type AuditLogInput = {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async log(input: AuditLogInput) {
    try {
      const entry = this.auditRepository.create({
        actorId: input.actorId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? null,
        ipAddress: input.ipAddress ?? null,
      });
      return await this.auditRepository.save(entry);
    } catch (error) {
      // Audit failures must never break primary flows
      console.error('Failed to write audit log:', error?.message || error);
      return null;
    }
  }

  async list(options: {
    page?: number;
    limit?: number;
    resource?: string;
    actorId?: string;
  }) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 200);

    const [items, total] = await this.auditRepository.findAndCount({
      where: {
        ...(options.resource ? { resource: options.resource } : {}),
        ...(options.actorId ? { actorId: options.actorId } : {}),
      },
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }
}
