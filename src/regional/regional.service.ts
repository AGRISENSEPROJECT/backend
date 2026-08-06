import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Farm } from '../entities/farm.entity';
import { User } from '../entities/user.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { NgoOrganization } from '../entities/ngo-organization.entity';
import { AgriculturalProgram } from '../entities/agricultural-program.entity';
import { GovernmentAdvisory } from '../entities/government-advisory.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateProgramDto, UpdateProgramDto, UpdateNgoProfileDto } from './dto/ngo.dto';
import { CreateAdvisoryDto, UpdateAdvisoryDto } from './dto/government.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class RegionalService {
  constructor(
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PredictionRun)
    private predictionRunRepository: Repository<PredictionRun>,
    @InjectRepository(NgoOrganization)
    private ngoRepository: Repository<NgoOrganization>,
    @InjectRepository(AgriculturalProgram)
    private programRepository: Repository<AgriculturalProgram>,
    @InjectRepository(GovernmentAdvisory)
    private advisoryRepository: Repository<GovernmentAdvisory>,
    private notificationService: NotificationService,
  ) {}

  private getAssignedRegions(user: User): string[] {
    if (!user.assignedRegions?.length) {
      throw new ForbiddenException('No regions assigned to your account');
    }
    return user.assignedRegions;
  }

  async getRegionalFarmStats(user: User) {
    const regions = this.getAssignedRegions(user);

    const farmsByProvince = await this.farmRepository
      .createQueryBuilder('farm')
      .select('farm.province', 'province')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(farm.size)', 'totalSize')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .groupBy('farm.province')
      .getRawMany();

    const totalFarms = await this.farmRepository
      .createQueryBuilder('farm')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .getCount();

    const totalFarmers = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.farms', 'farm')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('user.role = :role', { role: UserRole.FARMER })
      .getCount();

    return { assignedRegions: regions, totalFarms, totalFarmers, farmsByProvince };
  }

  async getRegionalFarms(user: User, page = 1, limit = 20, province?: string) {
    const regions = this.getAssignedRegions(user);
    const query = this.farmRepository
      .createQueryBuilder('farm')
      .leftJoinAndSelect('farm.user', 'user')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false');

    if (province) query.andWhere('farm.province = :province', { province });

    const [farms, total] = await query
      .orderBy('farm.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { farms, total, page, limit };
  }

  async getRegionalPredictions(user: User, page = 1, limit = 20) {
    const regions = this.getAssignedRegions(user);
    const [runs, total] = await this.predictionRunRepository
      .createQueryBuilder('run')
      .innerJoinAndSelect('run.farm', 'farm')
      .where('farm.province IN (:...regions)', { regions })
      .orderBy('run.executedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { runs, total, page, limit };
  }

  async getRegionalFarmers(user: User, page = 1, limit = 20) {
    const regions = this.getAssignedRegions(user);
    const [farmers, total] = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.farms', 'farm')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('user.role = :role', { role: UserRole.FARMER })
      .select(['user.id', 'user.firstName', 'user.lastName', 'user.email', 'user.phoneNumber', 'user.createdAt'])
      .groupBy('user.id')
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { farmers, total, page, limit };
  }

  async getDiseaseTrends(user: User) {
    const regions = this.getAssignedRegions(user);
    const runs = await this.predictionRunRepository
      .createQueryBuilder('run')
      .innerJoin('run.farm', 'farm')
      .where('farm.province IN (:...regions)', { regions })
      .orderBy('run.executedAt', 'DESC')
      .limit(500)
      .getMany();

    const trends: Record<string, number> = {};
    for (const run of runs) {
      const summary = run.predictionSummary as Record<string, unknown> | null;
      const disease = (summary?.disease as string) || (summary?.predictedDisease as string) || 'unknown';
      trends[disease] = (trends[disease] || 0) + 1;
    }
    return { regions, diseaseOutbreaks: trends, totalScans: runs.length };
  }

  async updateNgoProfile(userId: string, dto: UpdateNgoProfileDto) {
    const org = await this.ngoRepository.findOne({ where: { userId } });
    if (!org) throw new NotFoundException('NGO organization not found');
    Object.assign(org, dto);
    await this.ngoRepository.save(org);
    return { message: 'Organization profile updated', organization: org };
  }

  async getNgoProfile(userId: string) {
    const org = await this.ngoRepository.findOne({ where: { userId }, relations: ['user'] });
    if (!org) throw new NotFoundException('NGO organization not found');
    return org;
  }

  async createProgram(userId: string, dto: CreateProgramDto) {
    const program = this.programRepository.create({
      organizerId: userId,
      title: dto.title,
      description: dto.description,
      targetRegions: dto.targetRegions,
      budget: dto.budget,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });
    await this.programRepository.save(program);
    return { message: 'Program created', program };
  }

  async getPrograms(userId: string) {
    return this.programRepository.find({
      where: { organizerId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateProgram(userId: string, programId: string, dto: UpdateProgramDto) {
    const program = await this.programRepository.findOne({ where: { id: programId, organizerId: userId } });
    if (!program) throw new NotFoundException('Program not found');
    Object.assign(program, dto);
    await this.programRepository.save(program);
    return { message: 'Program updated', program };
  }

  async exportRegionalReport(user: User) {
    const stats = await this.getRegionalFarmStats(user);
    const predictions = await this.getRegionalPredictions(user, 1, 100);
    const trends = await this.getDiseaseTrends(user);
    return {
      generatedAt: new Date(),
      assignedRegions: stats.assignedRegions,
      statistics: stats,
      recentPredictions: predictions.runs,
      diseaseTrends: trends,
    };
  }

  async sendProgramNotification(userId: string, title: string, message: string, targetUserIds: string[]) {
    for (const id of targetUserIds) {
      await this.notificationService.create(id, title, message, NotificationType.SYSTEM);
    }
    return { message: 'Notifications sent', count: targetUserIds.length };
  }

  async createAdvisory(authorId: string, dto: CreateAdvisoryDto) {
    const advisory = this.advisoryRepository.create({
      authorId,
      title: dto.title,
      content: dto.content,
      type: dto.type,
      targetRegions: dto.targetRegions,
      isPublished: true,
    });
    await this.advisoryRepository.save(advisory);

    if (dto.targetRegions?.length) {
      const farmers = await this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.farms', 'farm')
        .where('farm.province IN (:...regions)', { regions: dto.targetRegions })
        .andWhere('user.role = :role', { role: UserRole.FARMER })
        .select('user.id')
        .getMany();

      for (const farmer of farmers) {
        await this.notificationService.create(
          farmer.id,
          dto.title,
          dto.content,
          NotificationType.SYSTEM,
          { advisoryType: dto.type },
        );
      }
    }

    return { message: 'Advisory published', advisory };
  }

  async getAdvisories(targetRegions?: string[]) {
    const qb = this.advisoryRepository.createQueryBuilder('advisory')
      .where('advisory.isPublished = true')
      .orderBy('advisory.createdAt', 'DESC');

    if (targetRegions?.length) {
      qb.andWhere('advisory.targetRegions && :regions', { regions: targetRegions });
    }

    return qb.getMany();
  }

  async updateAdvisory(authorId: string, id: string, dto: UpdateAdvisoryDto) {
    const advisory = await this.advisoryRepository.findOne({ where: { id, authorId } });
    if (!advisory) throw new NotFoundException('Advisory not found');
    Object.assign(advisory, dto);
    await this.advisoryRepository.save(advisory);
    return { message: 'Advisory updated', advisory };
  }

  async getNationalStatistics(user: User) {
    const totalFarms = await this.farmRepository.count({ where: { isArchived: false } });
    const farmsByProvince = await this.farmRepository
      .createQueryBuilder('farm')
      .select('farm.province', 'province')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(farm.size)', 'totalSize')
      .where('farm.isArchived = false')
      .groupBy('farm.province')
      .getRawMany();

    const totalFarmers = await this.userRepository.count({ where: { role: UserRole.FARMER } });
    const totalPredictions = await this.predictionRunRepository.count();

    return {
      assignedRegions: user.assignedRegions,
      totalFarms,
      totalFarmers,
      totalPredictions,
      farmsByProvince,
    };
  }

  async exportNationalReport(user: User) {
    const stats = await this.getNationalStatistics(user);
    const trends = await this.getDiseaseTrends(user);
    return {
      generatedAt: new Date(),
      nationalStatistics: stats,
      diseaseTrends: trends,
    };
  }
}
