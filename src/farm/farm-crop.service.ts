import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FarmCrop, CropStatus } from '../entities/farm-crop.entity';
import { Farm } from '../entities/farm.entity';
import { CreateFarmCropDto, UpdateFarmCropDto } from './dto/farm-crop.dto';

@Injectable()
export class FarmCropService {
  constructor(
    @InjectRepository(FarmCrop)
    private farmCropRepository: Repository<FarmCrop>,
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
  ) {}

  private async verifyFarmOwnership(userId: string, farmId: string) {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId, userId, isArchived: false },
    });
    if (!farm) throw new NotFoundException('Farm not found');
    return farm;
  }

  async recordCrop(userId: string, farmId: string, dto: CreateFarmCropDto) {
    await this.verifyFarmOwnership(userId, farmId);
    const crop = this.farmCropRepository.create({
      ...dto,
      farmId,
      userId,
      plantingDate: dto.plantingDate ? new Date(dto.plantingDate) : null,
      expectedHarvestDate: dto.expectedHarvestDate ? new Date(dto.expectedHarvestDate) : null,
      status: dto.status || CropStatus.PLANNED,
    });
    await this.farmCropRepository.save(crop);
    return { message: 'Crop recorded', crop };
  }

  async getFarmCrops(userId: string, farmId: string) {
    await this.verifyFarmOwnership(userId, farmId);
    return this.farmCropRepository.find({
      where: { farmId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateCrop(userId: string, farmId: string, cropId: string, dto: UpdateFarmCropDto) {
    await this.verifyFarmOwnership(userId, farmId);
    const crop = await this.farmCropRepository.findOne({
      where: { id: cropId, farmId, userId },
    });
    if (!crop) throw new NotFoundException('Crop record not found');

    if (dto.plantingDate) crop.plantingDate = new Date(dto.plantingDate);
    if (dto.expectedHarvestDate) crop.expectedHarvestDate = new Date(dto.expectedHarvestDate);
    Object.assign(crop, {
      cropType: dto.cropType ?? crop.cropType,
      variety: dto.variety ?? crop.variety,
      plantingSeason: dto.plantingSeason ?? crop.plantingSeason,
      harvestSeason: dto.harvestSeason ?? crop.harvestSeason,
      status: dto.status ?? crop.status,
      estimatedYield: dto.estimatedYield ?? crop.estimatedYield,
      areaPlanted: dto.areaPlanted ?? crop.areaPlanted,
    });

    await this.farmCropRepository.save(crop);
    return { message: 'Crop updated', crop };
  }

  async deleteCrop(userId: string, farmId: string, cropId: string) {
    await this.verifyFarmOwnership(userId, farmId);
    const crop = await this.farmCropRepository.findOne({
      where: { id: cropId, farmId, userId },
    });
    if (!crop) throw new NotFoundException('Crop record not found');
    await this.farmCropRepository.remove(crop);
    return { message: 'Crop record deleted' };
  }
}
