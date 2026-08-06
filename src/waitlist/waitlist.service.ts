import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WaitlistEntry,
  WaitlistRoleInterest,
} from '../entities/waitlist-entry.entity';
import { EmailService } from '../auth/email.service';
import { JoinWaitlistDto } from './dto/waitlist.dto';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepository: Repository<WaitlistEntry>,
    private readonly emailService: EmailService,
  ) {}

  async join(dto: JoinWaitlistDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.waitlistRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('This email is already on the AgriSense waitlist');
    }

    const entry = this.waitlistRepository.create({
      fullName: dto.fullName.trim(),
      email,
      phoneNumber: dto.phoneNumber?.trim() || null,
      interest: dto.interest || WaitlistRoleInterest.FARMER,
      organization: dto.organization?.trim() || null,
      province: dto.province?.trim() || null,
      message: dto.message?.trim() || null,
      source: dto.source?.trim() || 'website',
      welcomeEmailSent: false,
      isActive: true,
    });

    const saved = await this.waitlistRepository.save(entry);

    try {
      await this.emailService.sendWaitlistWelcomeEmail({
        email: saved.email,
        fullName: saved.fullName,
        interest: String(saved.interest),
        province: saved.province,
      });
      saved.welcomeEmailSent = true;
      saved.welcomeEmailSentAt = new Date();
      await this.waitlistRepository.save(saved);
    } catch (error) {
      this.logger.warn(
        `Waitlist welcome email failed for ${saved.email}: ${(error as Error).message}`,
      );
    }

    return {
      message:
        'You have been added to the AgriSense waitlist. A welcome email with platform highlights is on its way.',
      entry: {
        id: saved.id,
        fullName: saved.fullName,
        email: saved.email,
        interest: saved.interest,
        welcomeEmailSent: saved.welcomeEmailSent,
        createdAt: saved.createdAt,
      },
    };
  }

  async list(page = 1, limit = 20, interest?: string, search?: string) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const qb = this.waitlistRepository
      .createQueryBuilder('entry')
      .orderBy('entry.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (interest) {
      qb.andWhere('entry.interest = :interest', { interest });
    }
    if (search?.trim()) {
      qb.andWhere(
        '(LOWER(entry.email) LIKE :q OR LOWER(entry.fullName) LIKE :q OR LOWER(COALESCE(entry.organization, \'\')) LIKE :q)',
        { q: `%${search.trim().toLowerCase()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page: Math.max(page, 1),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }

  async getById(id: string) {
    const entry = await this.waitlistRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    return entry;
  }

  async resendWelcomeEmail(id: string) {
    const entry = await this.getById(id);
    await this.emailService.sendWaitlistWelcomeEmail({
      email: entry.email,
      fullName: entry.fullName,
      interest: String(entry.interest),
      province: entry.province,
    });
    entry.welcomeEmailSent = true;
    entry.welcomeEmailSentAt = new Date();
    await this.waitlistRepository.save(entry);
    return { message: 'Welcome email resent', email: entry.email };
  }

  async deactivate(id: string) {
    const entry = await this.getById(id);
    entry.isActive = false;
    await this.waitlistRepository.save(entry);
    return { message: 'Waitlist entry deactivated', id: entry.id };
  }

  async getStats() {
    const total = await this.waitlistRepository.count();
    const active = await this.waitlistRepository.count({ where: { isActive: true } });
    const emailed = await this.waitlistRepository.count({
      where: { welcomeEmailSent: true },
    });
    const byInterest = await this.waitlistRepository
      .createQueryBuilder('entry')
      .select('entry.interest', 'interest')
      .addSelect('COUNT(*)', 'count')
      .groupBy('entry.interest')
      .getRawMany();

    return { total, active, emailed, byInterest };
  }
}
