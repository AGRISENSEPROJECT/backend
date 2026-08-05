import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IoTSensor, IoTSensorStatus } from '../entities/iot-sensor.entity';
import { SensorReading } from '../entities/sensor-reading.entity';
import { Farm } from '../entities/farm.entity';
import { UserRole } from '../entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { AuditService } from '../audit/audit.service';
import {
  IngestReadingDto,
  RegisterSensorDto,
  UpdateSensorStatusDto,
} from './dto/iot.dto';

@Injectable()
export class IoTService {
  constructor(
    @InjectRepository(IoTSensor)
    private readonly sensorRepository: Repository<IoTSensor>,
    @InjectRepository(SensorReading)
    private readonly readingRepository: Repository<SensorReading>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
  ) {}

  private isAdmin(role?: UserRole) {
    return role === UserRole.ADMIN;
  }

  async registerSensor(userId: string, role: UserRole, dto: RegisterSensorDto) {
    const farm = await this.farmRepository.findOne({
      where: this.isAdmin(role) ? { id: dto.farmId } : { id: dto.farmId, userId },
    });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    const existing = await this.sensorRepository.findOne({
      where: { deviceId: dto.deviceId },
    });
    if (existing) {
      throw new ConflictException('Device ID already registered');
    }

    const sensor = await this.sensorRepository.save(
      this.sensorRepository.create({
        farmId: dto.farmId,
        userId: farm.userId,
        name: dto.name,
        deviceId: dto.deviceId,
        sensorType: dto.sensorType ?? 'soil_moisture',
        unit: dto.unit ?? '%',
        location: dto.location ?? null,
        status: IoTSensorStatus.ACTIVE,
      }),
    );

    await this.auditService.log({
      actorId: userId,
      action: 'iot_sensor.register',
      resource: 'iot_sensor',
      resourceId: sensor.id,
      metadata: { deviceId: sensor.deviceId, farmId: sensor.farmId },
    });

    return { message: 'Sensor registered', sensor };
  }

  async listSensors(userId: string, role: UserRole, farmId?: string) {
    const where: Record<string, string> = {};
    if (!this.isAdmin(role)) {
      where.userId = userId;
    }
    if (farmId) {
      where.farmId = farmId;
    }

    const sensors = await this.sensorRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return { count: sensors.length, sensors };
  }

  async updateStatus(
    userId: string,
    role: UserRole,
    sensorId: string,
    dto: UpdateSensorStatusDto,
  ) {
    const sensor = await this.getOwnedSensor(userId, role, sensorId);
    sensor.status = dto.status;
    await this.sensorRepository.save(sensor);
    return { message: 'Sensor status updated', sensor };
  }

  async ingestReading(userId: string, role: UserRole, dto: IngestReadingDto) {
    const sensor = await this.sensorRepository.findOne({
      where: { deviceId: dto.deviceId },
    });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }
    if (!this.isAdmin(role) && sensor.userId !== userId) {
      throw new ForbiddenException('Not allowed to write to this sensor');
    }

    const reading = await this.readingRepository.save(
      this.readingRepository.create({
        sensorId: sensor.id,
        value: dto.value,
        unit: dto.unit ?? sensor.unit,
        metadata: dto.metadata ?? null,
        recordedAt: new Date(),
      }),
    );

    await this.maybeAlert(sensor, Number(dto.value));

    return { message: 'Reading ingested', reading };
  }

  async listReadings(
    userId: string,
    role: UserRole,
    sensorId: string,
    limit = 50,
  ) {
    await this.getOwnedSensor(userId, role, sensorId);
    const readings = await this.readingRepository.find({
      where: { sensorId },
      order: { recordedAt: 'DESC' },
      take: Math.min(limit, 200),
    });
    return { count: readings.length, readings };
  }

  private async getOwnedSensor(userId: string, role: UserRole, sensorId: string) {
    const sensor = await this.sensorRepository.findOne({
      where: this.isAdmin(role)
        ? { id: sensorId }
        : { id: sensorId, userId },
    });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }
    return sensor;
  }

  private async maybeAlert(sensor: IoTSensor, value: number) {
    const type = sensor.sensorType.toLowerCase();
    let shouldAlert = false;
    let message = '';

    if (type.includes('moisture') && (value < 20 || value > 85)) {
      shouldAlert = true;
      message = `Soil moisture reading ${value}${sensor.unit} is outside the safe range (20–85).`;
    } else if (type.includes('temp') && (value < 5 || value > 40)) {
      shouldAlert = true;
      message = `Temperature reading ${value}${sensor.unit} is outside the safe range (5–40).`;
    }

    if (!shouldAlert) {
      return;
    }

    await this.notificationService.create({
      userId: sensor.userId,
      type: NotificationType.IOT_ALERT,
      title: `IoT alert: ${sensor.name}`,
      message,
      data: {
        sensorId: sensor.id,
        deviceId: sensor.deviceId,
        value,
      },
    });
  }
}
