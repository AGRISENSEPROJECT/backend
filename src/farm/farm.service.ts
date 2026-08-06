import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Farm } from '../entities/farm.entity';
import { User } from '../entities/user.entity';
import { CreateFarmDto, UpdateFarmDto } from './dto/create-farm.dto';
import { CloudinaryService } from '../auth/cloudinary.service';

@Injectable()
export class FarmService {
  constructor(
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createFarm(userId: string, createFarmDto: CreateFarmDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existingFarms = await this.farmRepository.count({
      where: { userId, isArchived: false },
    });

    const farm = this.farmRepository.create({
      ...createFarmDto,
      userId,
      user,
      isActive: existingFarms === 0,
    });

    await this.farmRepository.save(farm);

    if (farm.isActive) {
      user.activeFarmId = farm.id;
      await this.userRepository.save(user);
    }

    return { message: 'Farm created successfully', farm };
  }

  async getAllFarms(userId: string, includeArchived = false) {
    const where: any = { userId };
    if (!includeArchived) where.isArchived = false;

    const farms = await this.farmRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return { count: farms.length, farms };
  }

  async getFarm(userId: string, farmId: string) {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId, userId },
    });
    if (!farm) throw new NotFoundException('Farm not found');
    return farm;
  }

  async updateFarm(userId: string, farmId: string, updateFarmDto: UpdateFarmDto) {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId, userId, isArchived: false },
    });
    if (!farm) throw new NotFoundException('Farm not found');

    Object.assign(farm, updateFarmDto);
    await this.farmRepository.save(farm);
    return { message: 'Farm updated successfully', farm };
  }

  async archiveFarm(userId: string, farmId: string) {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId, userId, isArchived: false },
    });
    if (!farm) throw new NotFoundException('Farm not found');

    farm.isArchived = true;
    farm.isActive = false;
    farm.archivedAt = new Date();
    await this.farmRepository.save(farm);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user?.activeFarmId === farmId) {
      const nextFarm = await this.farmRepository.findOne({
        where: { userId, isArchived: false },
        order: { createdAt: 'DESC' },
      });
      user.activeFarmId = nextFarm?.id || null;
      await this.userRepository.save(user);
    }

    return { message: 'Farm archived successfully' };
  }

  async restoreFarm(userId: string, farmId: string) {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId, userId, isArchived: true },
    });
    if (!farm) throw new NotFoundException('Archived farm not found');

    farm.isArchived = false;
    farm.archivedAt = null;
    await this.farmRepository.save(farm);
    return { message: 'Farm restored successfully', farm };
  }

  async setActiveFarm(userId: string, farmId: string) {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId, userId, isArchived: false },
    });
    if (!farm) throw new NotFoundException('Farm not found');

    await this.farmRepository.update({ userId, isArchived: false }, { isActive: false });
    farm.isActive = true;
    await this.farmRepository.save(farm);

    await this.userRepository.update(userId, { activeFarmId: farmId });
    return { message: 'Active farm updated', farmId };
  }

  async uploadFarmImage(userId: string, farmId: string, file: Express.Multer.File) {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId, userId, isArchived: false },
    });
    if (!farm) throw new NotFoundException('Farm not found');

    if (farm.imageUrl) {
      await this.cloudinaryService.deleteImage(farm.imageUrl);
    }

    const imageUrl = await this.cloudinaryService.uploadImage(file);
    farm.imageUrl = imageUrl;
    await this.farmRepository.save(farm);
    return { message: 'Farm image uploaded', imageUrl };
  }

  async deleteFarm(userId: string, farmId: string) {
    return this.archiveFarm(userId, farmId);
  }
}
