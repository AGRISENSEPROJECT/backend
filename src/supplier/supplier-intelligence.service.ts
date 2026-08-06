import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Farm } from '../entities/farm.entity';
import { FarmCrop, CropStatus } from '../entities/farm-crop.entity';
import { Recommendation, RecommendationType } from '../entities/recommendation.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { SupplierProfile } from '../entities/supplier-profile.entity';
import { Product, ProductCategory } from '../entities/product.entity';
import { ApprovalStatus } from '../common/enums/approval-status.enum';

export type AnonymizedFarm = {
  farmRef: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  size: number;
  soilType: string;
  irrigationMethod: string | null;
  crops: Array<{
    cropType: string;
    status: CropStatus;
    plantingSeason: string | null;
    harvestSeason: string | null;
  }>;
};

@Injectable()
export class SupplierIntelligenceService {
  constructor(
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
    @InjectRepository(FarmCrop)
    private farmCropRepository: Repository<FarmCrop>,
    @InjectRepository(Recommendation)
    private recommendationRepository: Repository<Recommendation>,
    @InjectRepository(PredictionRun)
    private predictionRunRepository: Repository<PredictionRun>,
    @InjectRepository(SupplierProfile)
    private supplierProfileRepository: Repository<SupplierProfile>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async getSupplierProfile(supplierId: string) {
    const profile = await this.supplierProfileRepository.findOne({ where: { userId: supplierId } });
    if (!profile) throw new ForbiddenException('Supplier profile not found');
    if (profile.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Supplier not approved');
    }
    return profile;
  }

  private getServiceRegions(profile: SupplierProfile): string[] {
    if (!profile.serviceRegions?.length) {
      throw new ForbiddenException('Configure service regions in your profile first');
    }
    return profile.serviceRegions;
  }

  private farmRegionFilter(qb: any, regions: string[], alias = 'farm') {
    qb.andWhere(`${alias}.province IN (:...regions)`, { regions });
    qb.andWhere(`${alias}.isArchived = false`);
  }

  async getRegionalIntelligence(supplierId: string) {
    const profile = await this.getSupplierProfile(supplierId);
    const regions = this.getServiceRegions(profile);

    const cropDistribution = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('crop.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .groupBy('crop.cropType')
      .getRawMany();

    const cropByDistrict = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('farm.district', 'district')
      .addSelect('crop.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .groupBy('farm.district')
      .addGroupBy('crop.cropType')
      .getRawMany();

    const cropBySector = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('farm.sector', 'sector')
      .addSelect('farm.district', 'district')
      .addSelect('crop.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .groupBy('farm.sector')
      .addGroupBy('farm.district')
      .addGroupBy('crop.cropType')
      .getRawMany();

    const soilDistribution = await this.farmRepository
      .createQueryBuilder('farm')
      .select('farm.soilType', 'soilType')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .groupBy('farm.soilType')
      .getRawMany();

    const plantingPeriods = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('crop.plantingSeason', 'season')
      .addSelect('crop.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .groupBy('crop.plantingSeason')
      .addGroupBy('crop.cropType')
      .getRawMany();

    const harvestPeriods = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('crop.harvestSeason', 'season')
      .addSelect('crop.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .groupBy('crop.harvestSeason')
      .addGroupBy('crop.cropType')
      .getRawMany();

    const diseaseTrends = await this.recommendationRepository
      .createQueryBuilder('rec')
      .innerJoin('rec.farm', 'farm')
      .select('rec.diseasePrediction', 'disease')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('rec.diseasePrediction IS NOT NULL')
      .groupBy('rec.diseasePrediction')
      .getRawMany();

    const treatmentTrends = await this.recommendationRepository
      .createQueryBuilder('rec')
      .innerJoin('rec.farm', 'farm')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('rec.type IN (:...types)', {
        types: [RecommendationType.PESTICIDE, RecommendationType.HERBICIDE, RecommendationType.FERTILIZER],
      })
      .select('rec.type', 'type')
      .addSelect('rec.title', 'product')
      .addSelect('COUNT(*)', 'count')
      .groupBy('rec.type')
      .addGroupBy('rec.title')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    const totalFarms = await this.farmRepository
      .createQueryBuilder('farm')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .getCount();

    const productivity = await this.farmRepository
      .createQueryBuilder('farm')
      .select('farm.province', 'province')
      .addSelect('AVG(farm.size)', 'avgSize')
      .addSelect('SUM(farm.size)', 'totalArea')
      .addSelect('COUNT(*)', 'farmCount')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .groupBy('farm.province')
      .getRawMany();

    return {
      serviceRegions: regions,
      totalFarms,
      cropDistribution,
      cropByDistrict,
      cropBySector,
      soilDistribution,
      plantingPeriods,
      harvestPeriods,
      diseaseTrends,
      treatmentTrends,
      productivityStats: productivity,
      seasonalDemandForecast: this.buildSeasonalForecast(plantingPeriods, harvestPeriods),
    };
  }

  private buildSeasonalForecast(planting: any[], harvest: any[]) {
    const demand: Record<string, { planting: number; harvest: number }> = {};
    for (const p of planting) {
      const key = `${p.season || 'unknown'}_${p.cropType}`;
      if (!demand[key]) demand[key] = { planting: 0, harvest: 0 };
      demand[key].planting += Number(p.count);
    }
    for (const h of harvest) {
      const key = `${h.season || 'unknown'}_${h.cropType}`;
      if (!demand[key]) demand[key] = { planting: 0, harvest: 0 };
      demand[key].harvest += Number(h.count);
    }
    return Object.entries(demand).map(([key, val]) => ({
      seasonCrop: key,
      expectedPlantingActivity: val.planting,
      expectedHarvestActivity: val.harvest,
      estimatedInputDemand: val.planting * 1.5 + val.harvest * 0.5,
    }));
  }

  async discoverFarms(
    supplierId: string,
    filters: {
      province?: string;
      district?: string;
      sector?: string;
      cell?: string;
      village?: string;
      cropType?: string;
      minSize?: number;
      maxSize?: number;
      plantingSeason?: string;
      harvestSeason?: string;
      soilType?: string;
      irrigationMethod?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const profile = await this.getSupplierProfile(supplierId);
    const regions = this.getServiceRegions(profile);

    const qb = this.farmRepository
      .createQueryBuilder('farm')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false');

    if (filters.province) {
      if (!regions.includes(filters.province)) {
        throw new ForbiddenException('Province outside your service regions');
      }
      qb.andWhere('farm.province = :province', { province: filters.province });
    }
    if (filters.district) qb.andWhere('farm.district = :district', { district: filters.district });
    if (filters.sector) qb.andWhere('farm.sector = :sector', { sector: filters.sector });
    if (filters.cell) qb.andWhere('farm.cell = :cell', { cell: filters.cell });
    if (filters.village) qb.andWhere('farm.village = :village', { village: filters.village });
    if (filters.soilType) qb.andWhere('farm.soilType = :soilType', { soilType: filters.soilType });
    if (filters.irrigationMethod) qb.andWhere('farm.irrigationMethod = :irrigation', { irrigation: filters.irrigationMethod });
    if (filters.minSize) qb.andWhere('farm.size >= :minSize', { minSize: filters.minSize });
    if (filters.maxSize) qb.andWhere('farm.size <= :maxSize', { maxSize: filters.maxSize });

    if (filters.cropType || filters.plantingSeason || filters.harvestSeason) {
      qb.innerJoin(FarmCrop, 'crop', 'crop.farmId = farm.id');
      if (filters.cropType) qb.andWhere('crop.cropType = :cropType', { cropType: filters.cropType });
      if (filters.plantingSeason) qb.andWhere('crop.plantingSeason = :ps', { ps: filters.plantingSeason });
      if (filters.harvestSeason) qb.andWhere('crop.harvestSeason = :hs', { hs: filters.harvestSeason });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const [farms, total] = await qb
      .orderBy('farm.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const farmIds = farms.map((f) => f.id);
    const crops = farmIds.length
      ? await this.farmCropRepository.find({ where: { farmId: In(farmIds) } })
      : [];

    const anonymized: AnonymizedFarm[] = farms.map((farm) => ({
      farmRef: `farm_${farm.id.slice(0, 8)}`,
      province: farm.province,
      district: farm.district,
      sector: farm.sector,
      cell: farm.cell,
      village: farm.village,
      size: Number(farm.size),
      soilType: farm.soilType,
      irrigationMethod: farm.irrigationMethod,
      crops: crops
        .filter((c) => c.farmId === farm.id)
        .map((c) => ({
          cropType: c.cropType,
          status: c.status,
          plantingSeason: c.plantingSeason,
          harvestSeason: c.harvestSeason,
        })),
    }));

    return { farms: anonymized, total, page, limit };
  }

  async getAiDemandSignals(supplierId: string) {
    const profile = await this.getSupplierProfile(supplierId);
    const regions = this.getServiceRegions(profile);

    const recommendations = await this.recommendationRepository
      .createQueryBuilder('rec')
      .innerJoin('rec.farm', 'farm')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('farm.isArchived = false')
      .getMany();

    const seedDemand: Record<string, number> = {};
    const fertilizerDemand: Record<string, number> = {};
    const pesticideDemand: Record<string, number> = {};
    const herbicideDemand: Record<string, number> = {};
    const equipmentDemand: Record<string, number> = {};

    const farmSets: Record<string, Set<string>> = {};

    for (const rec of recommendations) {
      const key = rec.title;
      if (!farmSets[key]) farmSets[key] = new Set();
      farmSets[key].add(rec.farmId);

      switch (rec.type) {
        case RecommendationType.SEED:
        case RecommendationType.CROP:
          seedDemand[key] = (seedDemand[key] || 0) + 1;
          break;
        case RecommendationType.FERTILIZER:
        case RecommendationType.SOIL_IMPROVEMENT:
          fertilizerDemand[key] = (fertilizerDemand[key] || 0) + 1;
          break;
        case RecommendationType.PESTICIDE:
        case RecommendationType.DISEASE:
          pesticideDemand[key] = (pesticideDemand[key] || 0) + 1;
          break;
        case RecommendationType.HERBICIDE:
          herbicideDemand[key] = (herbicideDemand[key] || 0) + 1;
          break;
        case RecommendationType.EQUIPMENT:
        case RecommendationType.IRRIGATION:
          equipmentDemand[key] = (equipmentDemand[key] || 0) + 1;
          break;
      }
    }

    const toDemandList = (map: Record<string, number>) =>
      Object.entries(map)
        .map(([product, count]) => ({
          product,
          recommendationCount: count,
          farmsRequiring: farmSets[product]?.size || count,
          estimatedQuantity: count * 2,
        }))
        .sort((a, b) => b.farmsRequiring - a.farmsRequiring);

    return {
      serviceRegions: regions,
      seedVarieties: toDemandList(seedDemand),
      fertilizers: toDemandList(fertilizerDemand),
      pesticides: toDemandList(pesticideDemand),
      herbicides: toDemandList(herbicideDemand),
      equipment: toDemandList(equipmentDemand),
      totalRecommendations: recommendations.length,
      note: 'Anonymized aggregate demand — no farmer personal data exposed',
    };
  }

  async getHarvestVisibility(supplierId: string) {
    const profile = await this.getSupplierProfile(supplierId);
    const regions = this.getServiceRegions(profile);

    const cropsPlanted = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('crop.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('crop.status IN (:...statuses)', {
        statuses: [CropStatus.PLANTED, CropStatus.GROWING],
      })
      .groupBy('crop.cropType')
      .getRawMany();

    const readyForHarvest = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('crop.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(crop.estimatedYield)', 'estimatedYield')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('crop.status = :status', { status: CropStatus.READY_FOR_HARVEST })
      .groupBy('crop.cropType')
      .getRawMany();

    const harvested = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('crop.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .andWhere('crop.status = :status', { status: CropStatus.HARVESTED })
      .groupBy('crop.cropType')
      .getRawMany();

    const plantingProgress = await this.farmCropRepository
      .createQueryBuilder('crop')
      .innerJoin('crop.farm', 'farm')
      .select('farm.province', 'province')
      .addSelect('crop.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('farm.province IN (:...regions)', { regions })
      .groupBy('farm.province')
      .addGroupBy('crop.status')
      .getRawMany();

    return {
      serviceRegions: regions,
      cropsCurrentlyPlanted: cropsPlanted,
      cropsReadyForHarvest: readyForHarvest,
      harvestCompleted: harvested,
      estimatedProductionVolumes: readyForHarvest,
      regionalPlantingProgress: plantingProgress.filter((p) =>
        [CropStatus.PLANNED, CropStatus.PLANTED].includes(p.status as CropStatus),
      ),
      regionalHarvestingProgress: plantingProgress.filter((p) =>
        [CropStatus.READY_FOR_HARVEST, CropStatus.HARVESTED].includes(p.status as CropStatus),
      ),
    };
  }
}
