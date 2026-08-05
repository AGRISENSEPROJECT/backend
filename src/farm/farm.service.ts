import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Farm } from '../entities/farm.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateFarmDto, UpdateFarmDto } from './dto/create-farm.dto';

@Injectable()
export class FarmService {
  constructor(
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private isAdmin(role?: UserRole) {
    return role === UserRole.ADMIN;
  }

  async createFarm(userId: string, createFarmDto: CreateFarmDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const farm = this.farmRepository.create({
      ...createFarmDto,
      userId,
      user,
    });

    await this.farmRepository.save(farm);

    return {
      message: 'Farm created successfully',
      farm,
    };
  }

  async getAllFarms(userId: string, role?: UserRole) {
    const farms = await this.farmRepository.find({
      where: this.isAdmin(role) ? {} : { userId },
      relations: this.isAdmin(role) ? ['user'] : [],
      order: { createdAt: 'DESC' },
    });

    return {
      count: farms.length,
      farms,
    };
  }

  async getFarm(userId: string, farmId: string, role?: UserRole) {
    const farm = await this.farmRepository.findOne({
      where: this.isAdmin(role) ? { id: farmId } : { id: farmId, userId },
      relations: this.isAdmin(role) ? ['user'] : [],
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    return farm;
  }

  async updateFarm(
    userId: string,
    farmId: string,
    updateFarmDto: UpdateFarmDto,
    role?: UserRole,
  ) {
    const farm = await this.farmRepository.findOne({
      where: this.isAdmin(role) ? { id: farmId } : { id: farmId, userId },
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    Object.assign(farm, updateFarmDto);
    await this.farmRepository.save(farm);

    return {
      message: 'Farm updated successfully',
      farm,
    };
  }

  async deleteFarm(userId: string, farmId: string, role?: UserRole) {
    const farm = await this.farmRepository.findOne({
      where: this.isAdmin(role) ? { id: farmId } : { id: farmId, userId },
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    await this.farmRepository.remove(farm);

    return {
      message: 'Farm deleted successfully',
    };
  }
}
