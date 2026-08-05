import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  YieldForecast,
  YieldForecastStatus,
} from '../entities/yield-forecast.entity';
import { Farm } from '../entities/farm.entity';
import { UserRole } from '../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import {
  CreateYieldForecastDto,
  UpdateYieldForecastStatusDto,
} from './dto/yield.dto';

const BASELINE_TONS_PER_HECTARE: Record<string, number> = {
  maize: 2.5,
  beans: 1.2,
  rice: 3.0,
  potato: 8.0,
  banana: 12.0,
  coffee: 0.8,
  tea: 1.5,
  default: 2.0,
};

@Injectable()
export class YieldService {
  constructor(
    @InjectRepository(YieldForecast)
    private readonly yieldRepository: Repository<YieldForecast>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    private readonly auditService: AuditService,
  ) {}

  private isAdmin(role?: UserRole) {
    return role === UserRole.ADMIN;
  }

  private baselineYield(cropType: string, farmSizeHa: number) {
    const key = cropType.trim().toLowerCase();
    const rate = BASELINE_TONS_PER_HECTARE[key] ?? BASELINE_TONS_PER_HECTARE.default;
    const predicted = Number((rate * Number(farmSizeHa)).toFixed(4));
    const confidence = BASELINE_TONS_PER_HECTARE[key] ? 70 : 55;
    return { predicted, confidence, rate };
  }

  async createForecast(userId: string, role: UserRole, dto: CreateYieldForecastDto) {
    const farm = await this.farmRepository.findOne({
      where: this.isAdmin(role) ? { id: dto.farmId } : { id: dto.farmId, userId },
    });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    const baseline = this.baselineYield(dto.cropType, Number(farm.size));
    const forecast = await this.yieldRepository.save(
      this.yieldRepository.create({
        farmId: farm.id,
        userId: farm.userId,
        cropType: dto.cropType,
        predictedYieldTons: dto.predictedYieldTons ?? baseline.predicted,
        confidence: dto.confidence ?? baseline.confidence,
        method: 'baseline_v1',
        inputs: {
          farmSizeHa: Number(farm.size),
          tonsPerHa: baseline.rate,
          ...(dto.inputs ?? {}),
        },
        notes: dto.notes ?? null,
        status: YieldForecastStatus.DRAFT,
      }),
    );

    await this.auditService.log({
      actorId: userId,
      action: 'yield_forecast.create',
      resource: 'yield_forecast',
      resourceId: forecast.id,
      metadata: { farmId: farm.id, cropType: dto.cropType },
    });

    return { message: 'Yield forecast created', forecast };
  }

  async listForecasts(userId: string, role: UserRole, farmId?: string) {
    const where: Record<string, string> = {};
    if (!this.isAdmin(role) && role !== UserRole.GOVERNMENT && role !== UserRole.NGO) {
      where.userId = userId;
    }
    if (farmId) {
      where.farmId = farmId;
    }

    const forecasts = await this.yieldRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['farm'],
    });

    return { count: forecasts.length, forecasts };
  }

  async getForecast(userId: string, role: UserRole, id: string) {
    const forecast = await this.yieldRepository.findOne({
      where: { id },
      relations: ['farm'],
    });
    if (!forecast) {
      throw new NotFoundException('Yield forecast not found');
    }

    const canView =
      this.isAdmin(role) ||
      role === UserRole.GOVERNMENT ||
      role === UserRole.NGO ||
      forecast.userId === userId;

    if (!canView) {
      throw new NotFoundException('Yield forecast not found');
    }

    return forecast;
  }

  async updateStatus(
    userId: string,
    role: UserRole,
    id: string,
    dto: UpdateYieldForecastStatusDto,
  ) {
    const forecast = await this.yieldRepository.findOne({ where: { id } });
    if (!forecast) {
      throw new NotFoundException('Yield forecast not found');
    }
    if (!this.isAdmin(role) && forecast.userId !== userId) {
      throw new NotFoundException('Yield forecast not found');
    }

    forecast.status = dto.status;
    await this.yieldRepository.save(forecast);
    return { message: 'Forecast status updated', forecast };
  }
}
