import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  WeatherAlert,
  WeatherAlertSeverity,
} from '../entities/weather-alert.entity';
import { Farm } from '../entities/farm.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { AuditService } from '../audit/audit.service';
import {
  CreateWeatherAlertDto,
  ListWeatherAlertsQueryDto,
} from './dto/weather.dto';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    @InjectRepository(WeatherAlert)
    private readonly weatherAlertRepository: Repository<WeatherAlert>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async createAlert(dto: CreateWeatherAlertDto, actorId?: string) {
    if (dto.farmId) {
      const farm = await this.farmRepository.findOne({
        where: { id: dto.farmId },
      });
      if (!farm) {
        throw new NotFoundException('Farm not found');
      }
    }

    const alert = await this.weatherAlertRepository.save(
      this.weatherAlertRepository.create({
        title: dto.title,
        message: dto.message,
        severity: dto.severity ?? WeatherAlertSeverity.WARNING,
        province: dto.province ?? null,
        district: dto.district ?? null,
        farmId: dto.farmId ?? null,
        source: dto.source ?? 'manual',
      }),
    );

    await this.notifyAffectedFarmers(alert);
    await this.auditService.log({
      actorId: actorId ?? null,
      action: 'weather_alert.create',
      resource: 'weather_alert',
      resourceId: alert.id,
      metadata: { severity: alert.severity, province: alert.province },
    });

    return { message: 'Weather alert created', alert };
  }

  async listAlerts(query: ListWeatherAlertsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.weatherAlertRepository
      .createQueryBuilder('alert')
      .orderBy('alert.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.province) {
      qb.andWhere('alert.province = :province', { province: query.province });
    }
    if (query.district) {
      qb.andWhere('alert.district = :district', { district: query.district });
    }
    if (query.farmId) {
      qb.andWhere('alert.farmId = :farmId', { farmId: query.farmId });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getAlert(id: string) {
    const alert = await this.weatherAlertRepository.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException('Weather alert not found');
    }
    return alert;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncOpenWeatherAlerts() {
    const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
    if (!apiKey) {
      return;
    }

    const provinces = await this.farmRepository
      .createQueryBuilder('farm')
      .select('DISTINCT farm.province', 'province')
      .where('farm.province IS NOT NULL')
      .getRawMany<{ province: string }>();

    for (const { province } of provinces) {
      if (!province) continue;
      try {
        await this.fetchAndStoreProvinceAlert(province, apiKey);
      } catch (error) {
        this.logger.warn(
          `OpenWeather sync failed for ${province}: ${error?.message || error}`,
        );
      }
    }
  }

  private async fetchAndStoreProvinceAlert(province: string, apiKey: string) {
    const query = encodeURIComponent(`${province},RW`);
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      weather?: Array<{ main?: string; description?: string }>;
      main?: { temp?: number; humidity?: number };
      wind?: { speed?: number };
      name?: string;
    };

    const condition = data.weather?.[0]?.main?.toLowerCase() || '';
    const description = data.weather?.[0]?.description || 'Weather update';
    const wind = data.wind?.speed ?? 0;
    const humidity = data.main?.humidity ?? 0;

    let severity: WeatherAlertSeverity | null = null;
    if (['thunderstorm', 'tornado'].includes(condition) || wind >= 15) {
      severity = WeatherAlertSeverity.CRITICAL;
    } else if (['rain', 'drizzle', 'snow'].includes(condition) || humidity >= 90) {
      severity = WeatherAlertSeverity.WARNING;
    }

    if (!severity) {
      return;
    }

    const recent = await this.weatherAlertRepository.findOne({
      where: { province, source: 'openweather', severity },
      order: { createdAt: 'DESC' },
    });

    if (recent && Date.now() - recent.createdAt.getTime() < 6 * 60 * 60 * 1000) {
      return;
    }

    const alert = await this.weatherAlertRepository.save(
      this.weatherAlertRepository.create({
        province,
        title: `${severity.toUpperCase()}: ${description}`,
        message: `OpenWeather reports ${description} in ${province}. Temp ${data.main?.temp ?? 'n/a'}°C, wind ${wind} m/s, humidity ${humidity}%.`,
        severity,
        source: 'openweather',
        rawPayload: data as Record<string, unknown>,
        startsAt: new Date(),
      }),
    );

    await this.notifyAffectedFarmers(alert);
    this.logger.log(`Created OpenWeather alert for ${province}: ${severity}`);
  }

  private async notifyAffectedFarmers(alert: WeatherAlert) {
    const qb = this.farmRepository
      .createQueryBuilder('farm')
      .select('DISTINCT farm.userId', 'userId');

    if (alert.farmId) {
      qb.where('farm.id = :farmId', { farmId: alert.farmId });
    } else if (alert.province) {
      qb.where('farm.province = :province', { province: alert.province });
      if (alert.district) {
        qb.andWhere('farm.district = :district', { district: alert.district });
      }
    } else {
      return;
    }

    const rows = await qb.getRawMany<{ userId: string }>();
    if (rows.length === 0) {
      return;
    }

    await this.notificationService.createMany(
      rows.map((row) => ({
        userId: row.userId,
        type: NotificationType.WEATHER_ALERT,
        title: alert.title,
        message: alert.message,
        data: {
          weatherAlertId: alert.id,
          severity: alert.severity,
          province: alert.province,
        },
      })),
    );
  }
}
