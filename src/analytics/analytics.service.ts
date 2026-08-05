import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { Farm } from '../entities/farm.entity';
import { PredictionRun, PredictionStatus } from '../entities/prediction-run.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { Program, ProgramStatus } from '../entities/program.entity';
import { Organization, OrganizationType } from '../entities/organization.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    @InjectRepository(PredictionRun)
    private readonly predictionRunRepository: Repository<PredictionRun>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Program)
    private readonly programRepository: Repository<Program>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async getOverview() {
    const [
      totalUsers,
      farmers,
      suppliers,
      ngos,
      government,
      activeFarmers,
      totalFarms,
      successfulPredictions,
      failedPredictions,
      totalOrders,
      deliveredOrders,
      activePrograms,
      approvedNgos,
      approvedGovOrgs,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: UserRole.FARMER } }),
      this.userRepository.count({ where: { role: UserRole.SUPPLIER } }),
      this.userRepository.count({ where: { role: UserRole.NGO } }),
      this.userRepository.count({ where: { role: UserRole.GOVERNMENT } }),
      this.userRepository.count({
        where: { role: UserRole.FARMER, status: UserStatus.ACTIVE },
      }),
      this.farmRepository.count(),
      this.predictionRunRepository.count({
        where: { status: PredictionStatus.SUCCESS },
      }),
      this.predictionRunRepository.count({
        where: { status: PredictionStatus.FAILED },
      }),
      this.orderRepository.count(),
      this.orderRepository.count({ where: { status: OrderStatus.DELIVERED } }),
      this.programRepository.count({ where: { status: ProgramStatus.ACTIVE } }),
      this.organizationRepository.count({
        where: { type: OrganizationType.NGO },
      }),
      this.organizationRepository.count({
        where: { type: OrganizationType.GOVERNMENT },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        farmers,
        suppliers,
        ngos,
        government,
        activeFarmers,
      },
      farms: { total: totalFarms },
      predictions: {
        successful: successfulPredictions,
        failed: failedPredictions,
      },
      marketplace: {
        orders: totalOrders,
        deliveredOrders,
      },
      programs: {
        active: activePrograms,
      },
      organizations: {
        ngos: approvedNgos,
        government: approvedGovOrgs,
      },
    };
  }

  async getRegionalFarmStats(province?: string, district?: string) {
    const qb = this.farmRepository
      .createQueryBuilder('farm')
      .select('farm.province', 'province')
      .addSelect('farm.district', 'district')
      .addSelect('COUNT(farm.id)', 'farmCount')
      .addSelect('COALESCE(SUM(farm.size), 0)', 'totalSizeHa')
      .groupBy('farm.province')
      .addGroupBy('farm.district')
      .orderBy('farm.province', 'ASC')
      .addOrderBy('farm.district', 'ASC');

    if (province) {
      qb.andWhere('farm.province ILIKE :province', { province });
    }
    if (district) {
      qb.andWhere('farm.district ILIKE :district', { district });
    }

    const rows = await qb.getRawMany<{
      province: string;
      district: string;
      farmCount: string;
      totalSizeHa: string;
    }>();

    return {
      filters: { province: province ?? null, district: district ?? null },
      regions: rows.map((row) => ({
        province: row.province,
        district: row.district,
        farmCount: Number(row.farmCount),
        totalSizeHa: Number(row.totalSizeHa),
      })),
    };
  }

  async getPredictionStats(province?: string) {
    const qb = this.predictionRunRepository
      .createQueryBuilder('run')
      .innerJoin('run.farm', 'farm')
      .select('farm.province', 'province')
      .addSelect('run.status', 'status')
      .addSelect('COUNT(run.id)', 'count')
      .groupBy('farm.province')
      .addGroupBy('run.status')
      .orderBy('farm.province', 'ASC');

    if (province) {
      qb.andWhere('farm.province ILIKE :province', { province });
    }

    const rows = await qb.getRawMany<{
      province: string;
      status: string;
      count: string;
    }>();

    return {
      filters: { province: province ?? null },
      items: rows.map((row) => ({
        province: row.province,
        status: row.status,
        count: Number(row.count),
      })),
    };
  }

  async getProgramStats() {
    const qb = this.programRepository
      .createQueryBuilder('program')
      .leftJoin('program.programFarmers', 'pf')
      .leftJoin('program.organization', 'org')
      .select('program.id', 'programId')
      .addSelect('program.title', 'title')
      .addSelect('program.status', 'status')
      .addSelect('program.province', 'province')
      .addSelect('program.district', 'district')
      .addSelect('program.targetFarmers', 'targetFarmers')
      .addSelect('org.name', 'organizationName')
      .addSelect('COUNT(pf.id)', 'assignedFarmers')
      .groupBy('program.id')
      .addGroupBy('org.name')
      .orderBy('program.createdAt', 'DESC');

    const rows = await qb.getRawMany<{
      programId: string;
      title: string;
      status: string;
      province: string;
      district: string;
      targetFarmers: string;
      organizationName: string;
      assignedFarmers: string;
    }>();

    return {
      items: rows.map((row) => ({
        programId: row.programId,
        title: row.title,
        status: row.status,
        province: row.province,
        district: row.district,
        organizationName: row.organizationName,
        targetFarmers: Number(row.targetFarmers),
        assignedFarmers: Number(row.assignedFarmers),
      })),
    };
  }
}
