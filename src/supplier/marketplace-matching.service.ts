import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Recommendation, RecommendationType } from '../entities/recommendation.entity';
import { SupplierProfile } from '../entities/supplier-profile.entity';
import { Farm } from '../entities/farm.entity';
import { ApprovalStatus } from '../common/enums/approval-status.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';

type MatchedProduct = {
  product: Product;
  supplier: {
    id: string;
    businessName: string;
    rating: number;
    deliveryCapability: boolean;
    logoUrl: string | null;
  };
  matchScore: number;
  matchReasons: string[];
};

@Injectable()
export class MarketplaceMatchingService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Recommendation)
    private recommendationRepository: Repository<Recommendation>,
    @InjectRepository(SupplierProfile)
    private supplierProfileRepository: Repository<SupplierProfile>,
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
    private notificationService: NotificationService,
  ) {}

  private recommendationToCategories(type: RecommendationType): string[] {
    const map: Record<string, string[]> = {
      [RecommendationType.SEED]: ['SEEDS'],
      [RecommendationType.CROP]: ['SEEDS'],
      [RecommendationType.FERTILIZER]: ['FERTILIZER'],
      [RecommendationType.SOIL_IMPROVEMENT]: ['FERTILIZER', 'CHEMICALS'],
      [RecommendationType.PESTICIDE]: ['PESTICIDE', 'CHEMICALS'],
      [RecommendationType.HERBICIDE]: ['HERBICIDE', 'CHEMICALS'],
      [RecommendationType.DISEASE]: ['PESTICIDE', 'CHEMICALS'],
      [RecommendationType.IRRIGATION]: ['IRRIGATION', 'EQUIPMENT'],
      [RecommendationType.EQUIPMENT]: ['MACHINERY', 'EQUIPMENT', 'TOOLS'],
    };
    return map[type] || ['OTHER'];
  }

  async matchProductsForFarmer(farmerId: string, farmId: string, recommendationIds?: string[]) {
    const farm = await this.farmRepository.findOne({ where: { id: farmId, userId: farmerId } });
    if (!farm) return { matches: [], message: 'Farm not found' };

    let recommendations: Recommendation[];
    if (recommendationIds?.length) {
      recommendations = await this.recommendationRepository.find({
        where: { id: In(recommendationIds), farmId, userId: farmerId },
      });
    } else {
      recommendations = await this.recommendationRepository.find({
        where: { farmId, userId: farmerId },
        order: { createdAt: 'DESC' },
        take: 20,
      });
    }

    const products = await this.productRepository
      .createQueryBuilder('product')
      .innerJoin(SupplierProfile, 'profile', 'profile.userId = product.supplierId')
      .where('product.isActive = true')
      .andWhere('product.isArchived = false')
      .andWhere('product.stock > 0')
      .andWhere('profile.approvalStatus = :approved', { approved: ApprovalStatus.APPROVED })
      .getMany();

    const profiles = await this.supplierProfileRepository.find({
      where: { approvalStatus: ApprovalStatus.APPROVED },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const matches: MatchedProduct[] = [];

    for (const product of products) {
      const profile = profileMap.get(product.supplierId);
      if (!profile) continue;

      const servesRegion =
        !profile.serviceRegions?.length ||
        profile.serviceRegions.includes(farm.province) ||
        product.serviceRegions?.includes(farm.province);

      if (!servesRegion) continue;

      let score = 0;
      const reasons: string[] = [];

      if (profile.verificationStatus === ApprovalStatus.APPROVED) {
        score += 10;
        reasons.push('Verified supplier');
      }
      if (profile.deliveryCapability) {
        score += 5;
        reasons.push('Delivery available');
      }
      score += Number(profile.rating) * 2;

      if (product.stock > 10) {
        score += 5;
        reasons.push('In stock');
      }

      for (const rec of recommendations) {
        const categories = this.recommendationToCategories(rec.type);
        if (categories.includes(product.category)) {
          score += 15;
          reasons.push(`Matches AI ${rec.type} recommendation`);
        }
        if (product.suitableCrops?.includes(rec.cropType || '')) {
          score += 10;
          reasons.push(`Suitable for ${rec.cropType}`);
        }
        if (product.suitableSoilTypes?.includes(farm.soilType)) {
          score += 8;
          reasons.push('Matches soil type');
        }
        const titleLower = rec.title.toLowerCase();
        if (product.name.toLowerCase().includes(titleLower) || titleLower.includes(product.name.toLowerCase())) {
          score += 20;
          reasons.push('Product matches AI recommendation title');
        }
      }

      if (score > 0) {
        matches.push({
          product,
          supplier: {
            id: profile.userId,
            businessName: profile.businessName,
            rating: Number(profile.rating),
            deliveryCapability: profile.deliveryCapability,
            logoUrl: profile.logoUrl,
          },
          matchScore: score,
          matchReasons: [...new Set(reasons)],
        });
      }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    return {
      farmId,
      province: farm.province,
      totalMatches: matches.length,
      matches: matches.slice(0, 50),
      note: 'Farmers independently choose products — AI does not auto-purchase',
    };
  }

  async notifySuppliersOfDemand(farmId: string, recommendationIds: string[]) {
    const farm = await this.farmRepository.findOne({ where: { id: farmId } });
    if (!farm) return;

    const recommendations = await this.recommendationRepository.find({
      where: { id: In(recommendationIds) },
    });

    const profiles = await this.supplierProfileRepository.find({
      where: { approvalStatus: ApprovalStatus.APPROVED },
    });

    const relevantSuppliers = profiles.filter(
      (p) => !p.serviceRegions?.length || p.serviceRegions.includes(farm.province),
    );

    for (const profile of relevantSuppliers) {
      const categories = new Set<string>();
      for (const rec of recommendations) {
        this.recommendationToCategories(rec.type).forEach((c) => categories.add(c));
      }

      const hasMatchingProducts = await this.productRepository
        .createQueryBuilder('product')
        .where('product.supplierId = :supplierId', { supplierId: profile.userId })
        .andWhere('product.category IN (:...categories)', { categories: [...categories] })
        .andWhere('product.isActive = true')
        .andWhere('product.stock > 0')
        .getCount();

      if (hasMatchingProducts > 0) {
        await this.notificationService.create(
          profile.userId,
          'New Regional Demand Signal',
          `AI recommendations in ${farm.province} may require products you supply. Check demand dashboard.`,
          NotificationType.ORDER,
          { province: farm.province, farmId: `anon_${farmId.slice(0, 8)}` },
        );
      }
    }
  }
}
