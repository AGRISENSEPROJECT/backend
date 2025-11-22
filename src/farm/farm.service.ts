import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Farm } from '../entities/farm.entity';
import { User } from '../entities/user.entity';
import {
  CreateFarmDto,
  UpdateFarmLocationDto,
  UpdateFarmOwnerDto,
} from './dto/create-farm.dto';

@Injectable()
export class FarmService {
  constructor(
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createFarm(userId: string, createFarmDto: CreateFarmDto) {
    // Check if user already has a farm
    const existingFarm = await this.farmRepository.findOne({
      where: { userId },
    });

    if (existingFarm) {
      throw new BadRequestException('User already has a farm');
    }

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
      // Set default values for required fields
      country: '',
      district: '',
      ownerName: '',
      ownerPhone: '',
      ownerEmail: user.email,
    });

    await this.farmRepository.save(farm);

    return {
      message: 'Farm created successfully',
      farm: {
        id: farm.id,
        name: farm.name,
        size: farm.size,
        soilType: farm.soilType,
      },
    };
  }

  async updateFarmLocation(
    userId: string,
    updateLocationDto: UpdateFarmLocationDto,
  ) {
    const farm = await this.farmRepository.findOne({
      where: { userId },
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    Object.assign(farm, updateLocationDto);
    await this.farmRepository.save(farm);

    return {
      message: 'Farm location updated successfully',
      farm,
    };
  }

  async updateFarmOwner(userId: string, updateOwnerDto: UpdateFarmOwnerDto) {
    const farm = await this.farmRepository.findOne({
      where: { userId },
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    Object.assign(farm, updateOwnerDto);
    await this.farmRepository.save(farm);

    return {
      message: 'Farm owner information updated successfully',
      farm,
    };
  }

  async getFarm(userId: string) {
    const farm = await this.farmRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    return farm;
  }

  async getFarmRegistrationStatus(userId: string) {
    const farm = await this.farmRepository.findOne({
      where: { userId },
    });

    if (!farm) {
      return {
        hasFarm: false,
        hasLocation: false,
        hasOwnerInfo: false,
        isComplete: false,
      };
    }

    const hasLocation = !!(farm.country && farm.district);
    const hasOwnerInfo = !!(farm.ownerName && farm.ownerPhone && farm.ownerEmail);

    return {
      hasFarm: true,
      hasLocation,
      hasOwnerInfo,
      isComplete: hasLocation && hasOwnerInfo,
      farm,
    };
  }
}