import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import { Farm } from '../entities/farm.entity';
import { PredictionRun, PredictionStatus } from '../entities/prediction-run.entity';
import {
  Recommendation,
  RecommendationType,
} from '../entities/recommendation.entity';
import { SoilScan, SoilScanSource } from '../entities/soil-scan.entity';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  PredictionHistoryQueryDto,
  RecommendationQueryDto,
} from './dto/history-query.dto';
import { MarketplaceMatchingService } from '../supplier/marketplace-matching.service';

type PlainObject = Record<string, unknown>;
type ModelPayload = {
  temperature: number;
  humidity: number;
  rainfall: number;
  cropType: string | null;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  soilMoisture: number | null;
  lat: number | null;
  lon: number | null;
};

type ExtractedRecommendation = {
  type: RecommendationType;
  title: string;
  payload: PlainObject;
  rank: number;
  isPrimary: boolean;
};

@Injectable()
export class PredictionService {
  constructor(
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    @InjectRepository(SoilScan)
    private readonly soilScanRepository: Repository<SoilScan>,
    @InjectRepository(PredictionRun)
    private readonly predictionRunRepository: Repository<PredictionRun>,
    @InjectRepository(Recommendation)
    private readonly recommendationRepository: Repository<Recommendation>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => MarketplaceMatchingService))
    private readonly marketplaceMatchingService: MarketplaceMatchingService,
  ) {}

  async runPrediction(
    userId: string,
    dto: CreatePredictionDto,
    imageFile: Express.Multer.File,
  ) {
    const farm = await this.farmRepository.findOne({
      where: { id: dto.farmId, userId },
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    const soilScan = this.soilScanRepository.create({
      userId,
      farmId: dto.farmId,
      source: dto.source ?? SoilScanSource.IMAGE,
      rawImageUrl: dto.rawImageUrl ?? null,
      moisture: dto.humidity,
      temperature: dto.temperature,
      phLevel: dto.phLevel ?? null,
      soilType: dto.soilType ?? null,
      organicLevels: dto.organicLevels ?? null,
      soilColor: dto.soilColor ?? null,
      soilStructure: dto.soilStructure ?? null,
      nitrogen: dto.nitrogen,
      phosphorus: dto.phosphorus,
      potassium: dto.potassium,
      propertyRates: dto.propertyRates ?? null,
      npkRates: dto.npkRates ?? null,
      rawInput: {
        ...this.toPlainObject(dto),
        image: {
          originalName: imageFile.originalname,
          mimeType: imageFile.mimetype,
          size: imageFile.size,
        },
      },
    });

    await this.soilScanRepository.save(soilScan);

    const modelName = dto.modelName ?? 'agrisense-model';
    const modelVersion = dto.modelVersion ?? null;
    const modelPayload = this.buildModelPayload(dto, soilScan);

    const predictionRun = this.predictionRunRepository.create({
      userId,
      farmId: dto.farmId,
      soilScanId: soilScan.id,
      modelName,
      modelVersion,
      status: PredictionStatus.PENDING,
      inputPayload: modelPayload,
    });

    await this.predictionRunRepository.save(predictionRun);

    try {
      const modelResponse = await this.callModelApi(modelPayload, imageFile);
      const summary = this.extractSummary(modelResponse);
      const recommendations = this.extractRecommendations(modelResponse);

      predictionRun.status = PredictionStatus.SUCCESS;
      predictionRun.predictionSummary = summary;
      predictionRun.rawResponse = this.toPlainObject(modelResponse);
      predictionRun.errorMessage = null;
      await this.predictionRunRepository.save(predictionRun);

      if (summary.soilTexture != null && soilScan.soilType == null) {
        soilScan.soilType = String(summary.soilTexture);
        await this.soilScanRepository.save(soilScan);
      }

      if (recommendations.length > 0) {
        const recommendationEntities = recommendations.map((recommendation) =>
          this.recommendationRepository.create({
            predictionId: predictionRun.id,
            userId,
            farmId: dto.farmId,
            type: recommendation.type,
            title: recommendation.title,
            payload: recommendation.payload,
            rank: recommendation.rank,
            isPrimary: recommendation.isPrimary,
            cropType: dto.crop_type ?? (summary.bestCrop as string) ?? null,
            growingSeason: (summary.season as string) ?? null,
            soilType: farm.soilType ?? (summary.soilTexture as string) ?? null,
            weatherConditions: {
              temperature: dto.temperature,
              humidity: dto.humidity,
              rainfall: dto.rainfall,
            },
            diseasePrediction: (summary.disease as string) ?? (summary.predictedDisease as string) ?? null,
            confidenceScore: this.normalizeConfidenceScore(summary.confidence),
            aiModelVersion: modelVersion,
          }),
        );

        const saved = await this.recommendationRepository.save(recommendationEntities);

        await this.marketplaceMatchingService.notifySuppliersOfDemand(
          dto.farmId,
          saved.map((r) => r.id),
        );

        return {
          message: 'Prediction completed and stored successfully',
          predictionRunId: predictionRun.id,
          soilScan,
          summary,
          recommendations: saved,
          rawResponse: modelResponse,
          recommendationIds: saved.map((r) => r.id),
        };
      }

      return {
        message: 'Prediction completed and stored successfully',
        predictionRunId: predictionRun.id,
        soilScan,
        summary,
        recommendations: [],
        rawResponse: modelResponse,
      };
    } catch (error) {
      predictionRun.status = PredictionStatus.FAILED;
      predictionRun.errorMessage = this.toErrorMessage(error);
      predictionRun.rawResponse = null;
      await this.predictionRunRepository.save(predictionRun);

      throw new BadGatewayException({
        message: 'Failed to fetch prediction from model API',
        details: this.toErrorMessage(error),
      });
    }
  }

  async getDashboard(userId: string, query: DashboardQueryDto) {
    const limit = query.limit ?? 10;

    if (query.farmId) {
      const farm = await this.farmRepository.findOne({
        where: { id: query.farmId, userId },
      });
      if (!farm) {
        throw new NotFoundException('Farm not found');
      }
    }

    const where = query.farmId ? { userId, farmId: query.farmId } : { userId };

    const latestSoilScan = await this.soilScanRepository.findOne({
      where,
      order: { scannedAt: 'DESC' },
    });

    const recentSoilScans = await this.soilScanRepository.find({
      where,
      order: { scannedAt: 'DESC' },
      take: Math.min(limit * 2, 50),
    });

    const recentRuns = await this.predictionRunRepository.find({
      where,
      order: { executedAt: 'DESC' },
      take: limit,
    });

    const recentRunIds = recentRuns.map((run) => run.id);

    const recentRecommendations =
      recentRunIds.length > 0
        ? await this.recommendationRepository.find({
            where: { predictionId: In(recentRunIds) },
            order: { rank: 'ASC', createdAt: 'DESC' },
          })
        : [];

    const recommendationsByRun = new Map<string, Recommendation[]>();
    for (const recommendation of recentRecommendations) {
      const list = recommendationsByRun.get(recommendation.predictionId) ?? [];
      list.push(recommendation);
      recommendationsByRun.set(recommendation.predictionId, list);
    }

    const history = recentRuns.map((run) => ({
      ...run,
      recommendations: recommendationsByRun.get(run.id) ?? [],
    }));

    const latestRun = history[0] ?? null;

    return {
      latestSoilComposition: latestSoilScan,
      history,
      trends: this.buildTrends(recentSoilScans),
      suggestions: latestRun
        ? this.groupRecommendationsByType(latestRun.recommendations)
        : {
            crop: [],
            fertilizer: [],
            irrigation: [],
            general: [],
          },
    };
  }

  async getRecommendationHistory(userId: string, query: RecommendationQueryDto) {
    await this.assertFarmOwnership(userId, query.farmId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.recommendationRepository.findAndCount({
      where: {
        userId,
        ...(query.farmId ? { farmId: query.farmId } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      order: { createdAt: 'DESC', rank: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async getPredictionHistory(userId: string, query: PredictionHistoryQueryDto) {
    await this.assertFarmOwnership(userId, query.farmId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.predictionRunRepository.findAndCount({
      where: {
        userId,
        ...(query.farmId ? { farmId: query.farmId } : {}),
      },
      relations: { recommendations: true, soilScan: true },
      order: { executedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async getPredictionRun(userId: string, id: string) {
    const run = await this.predictionRunRepository.findOne({
      where: { id, userId },
      relations: { recommendations: true, soilScan: true },
    });

    if (!run) {
      throw new NotFoundException('Prediction run not found');
    }

    run.recommendations.sort((a, b) => a.rank - b.rank);
    return run;
  }

  private async assertFarmOwnership(userId: string, farmId?: string) {
    if (!farmId) {
      return;
    }
    const farm = await this.farmRepository.findOne({ where: { id: farmId, userId } });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }
  }

  private buildModelPayload(dto: CreatePredictionDto, soilScan: SoilScan): PlainObject {
    return {
      temperature: Number(soilScan.temperature),
      humidity: Number(soilScan.moisture),
      rainfall: Number(dto.rainfall),
      cropType: dto.crop_type ?? null,
      nitrogen: Number(soilScan.nitrogen),
      phosphorus: Number(soilScan.phosphorus),
      potassium: Number(soilScan.potassium),
      soilMoisture: dto.soil_moisture ?? null,
      lat: dto.lat ?? null,
      lon: dto.lon ?? null,
    };
  }

  private async callModelApi(
    payload: PlainObject,
    imageFile: Express.Multer.File,
  ): Promise<unknown> {
    const baseUrl =
      this.configService.get<string>('MODEL_API_URL') ??
      'https://agrisense-api.onrender.com';
    const path = this.configService.get<string>('MODEL_PREDICT_PATH') ?? '/predict';
    const timeout = Number(this.configService.get('MODEL_API_TIMEOUT_MS') ?? 30000);

    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${normalizedBase}${normalizedPath}`;

    const modelPayload = payload as ModelPayload;
    const formData = new FormData();
    const imageBlob = new Blob([new Uint8Array(imageFile.buffer)], {
      type: imageFile.mimetype || 'application/octet-stream',
    });
    formData.append('image', imageBlob, imageFile.originalname || 'soil-image');
    formData.append('temperature', String(modelPayload.temperature));
    formData.append('humidity', String(modelPayload.humidity));
    formData.append('rainfall', String(modelPayload.rainfall));
    formData.append('nitrogen', String(modelPayload.nitrogen));
    formData.append('phosphorus', String(modelPayload.phosphorus));
    formData.append('potassium', String(modelPayload.potassium));
    if (modelPayload.cropType != null) {
      formData.append('crop_type', modelPayload.cropType);
    }
    if (modelPayload.soilMoisture != null) {
      formData.append('soil_moisture', String(modelPayload.soilMoisture));
    }
    if (modelPayload.lat != null) {
      formData.append('lat', String(modelPayload.lat));
    }
    if (modelPayload.lon != null) {
      formData.append('lon', String(modelPayload.lon));
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(timeout),
    });

    const responseText = await response.text();
    if (!response.ok) {
      const trimmed = responseText.trim();
      throw new Error(
        `Model API error (${response.status}): ${trimmed.length > 0 ? trimmed : 'No response body'}`,
      );
    }

    if (!responseText) {
      return {};
    }

    try {
      return JSON.parse(responseText);
    } catch {
      return { raw: responseText };
    }
  }

  private extractSummary(rawResponse: unknown): PlainObject {
    const response = this.toPlainObject(rawResponse);
    const soilAnalysis = this.toPlainObject(response.soil_analysis);
    const cropBlock = this.findCategoryBlock(response, 'crop');

    // Grouped /predict shape: crop block carries best_crop + confidence.
    if (cropBlock) {
      const fertilizerBlock = this.findCategoryBlock(response, 'fertilizer');
      const diseaseBlock = this.findCategoryBlock(response, 'disease');
      const diseaseData = diseaseBlock ? this.toPlainObject(diseaseBlock.data) : {};
      return {
        bestCrop: cropBlock.best_crop ?? null,
        confidence: cropBlock.confidence ?? null,
        disease: diseaseData.disease ?? diseaseData.predicted_disease ?? null,
        predictedDisease: diseaseData.disease ?? diseaseData.predicted_disease ?? null,
        season: response.season ?? response.growing_season ?? null,
        soilTexture: soilAnalysis.texture ?? null,
        soilMoisture: soilAnalysis.moisture ?? null,
        fertilizer: fertilizerBlock
          ? (this.toPlainObject(fertilizerBlock.data).recommended_fertilizer ?? null)
          : null,
        timestamp: response.timestamp ?? null,
        modelVersion: response.model_version ?? null,
      };
    }

    // Flat /comprehensive-analyze shape.
    const cropRecommendations = Array.isArray(response.crop_recommendations)
      ? response.crop_recommendations
      : [];
    const primaryCrop = this.toPlainObject(cropRecommendations[0]);
    const fertilizer = this.toPlainObject(response.fertilizer_recommendation);

    return {
      bestCrop: primaryCrop.crop ?? null,
      confidence: primaryCrop.suitability_score ?? null,
      soilTexture: soilAnalysis.texture ?? response.soil_texture ?? null,
      soilMoisture: soilAnalysis.moisture ?? null,
      fertilizer: fertilizer.recommended_fertilizer ?? response.fertilizer ?? null,
      timestamp: response.timestamp ?? null,
    };
  }

  private extractRecommendations(rawResponse: unknown): ExtractedRecommendation[] {
    const response = this.toPlainObject(rawResponse);
    const recommendations: ExtractedRecommendation[] = [];

    const append = (
      type: RecommendationType,
      title: string,
      payload: unknown,
      isPrimary = false,
    ) => {
      recommendations.push({
        type,
        title,
        payload: this.toPlainObject(payload),
        rank: recommendations.length,
        isPrimary,
      });
    };

    const groupedBlocks = Array.isArray(response.recommendations)
      ? response.recommendations
          .map((block) => this.toPlainObject(block))
          .filter((block) => typeof block.category === 'string')
      : [];

    if (groupedBlocks.length > 0) {
      // Grouped /predict shape: one block per category.
      for (const block of groupedBlocks) {
        const category = String(block.category).toLowerCase();

        if (category.includes('crop')) {
          const crops = Array.isArray(block.data) ? block.data : [];
          const bestCrop = block.best_crop ?? null;
          crops.forEach((item, index) => {
            const plain = this.toPlainObject(item);
            const isBest =
              bestCrop != null ? plain.crop === bestCrop : index === 0;
            append(
              RecommendationType.CROP,
              String(plain.crop ?? `Crop Recommendation ${index + 1}`),
              { ...plain, ...(isBest ? { confidence: block.confidence ?? null } : {}) },
              isBest,
            );
          });
          if (crops.length === 0 && bestCrop != null) {
            append(
              RecommendationType.CROP,
              String(bestCrop),
              { crop: bestCrop, confidence: block.confidence ?? null },
              true,
            );
          }
        } else if (category.includes('irrigation')) {
          append(RecommendationType.IRRIGATION, 'Irrigation Recommendation', block.data);
        } else if (category.includes('fertilizer')) {
          append(RecommendationType.FERTILIZER, 'Fertilizer Recommendation', block.data);
        } else if (category.includes('disease')) {
          const data = this.toPlainObject(block.data);
          const diseaseName = data.disease ?? data.predicted_disease ?? data.name ?? 'Disease Analysis';
          append(RecommendationType.DISEASE, String(diseaseName), block.data);
          if (data.treatment || data.pesticide) {
            append(
              RecommendationType.PESTICIDE,
              String(data.treatment ?? data.pesticide),
              { product: data.treatment ?? data.pesticide, disease: diseaseName, ...data },
            );
          }
        } else if (category.includes('pesticide') || category.includes('herbicide')) {
          const type = category.includes('herbicide')
            ? RecommendationType.HERBICIDE
            : RecommendationType.PESTICIDE;
          const data = this.toPlainObject(block.data);
          append(type, String(data.product ?? data.name ?? block.category), block.data);
        } else if (category.includes('seed')) {
          const data = Array.isArray(block.data) ? block.data : [block.data];
          data.forEach((item, index) => {
            const plain = this.toPlainObject(item);
            append(
              RecommendationType.SEED,
              String(plain.variety ?? plain.seed ?? plain.name ?? `Seed ${index + 1}`),
              plain,
              index === 0,
            );
          });
        } else if (category.includes('equipment') || category.includes('machinery')) {
          append(RecommendationType.EQUIPMENT, String(block.category), block.data);
        } else if (category.includes('soil')) {
          append(RecommendationType.SOIL_IMPROVEMENT, 'Soil Improvement', block.data);
        } else if (category.includes('weather')) {
          append(RecommendationType.WEATHER, 'Weather Forecast', block.data);
        } else {
          append(RecommendationType.GENERAL, String(block.category), block.data);
        }
      }
    } else {
      // Flat /comprehensive-analyze shape.
      const crops = Array.isArray(response.crop_recommendations)
        ? response.crop_recommendations
        : [];
      crops.forEach((item, index) => {
        const plain = this.toPlainObject(item);
        append(
          RecommendationType.CROP,
          String(plain.crop ?? `Crop Recommendation ${index + 1}`),
          plain,
          index === 0,
        );
      });

      if (response.irrigation_recommendation) {
        append(
          RecommendationType.IRRIGATION,
          'Irrigation Recommendation',
          response.irrigation_recommendation,
        );
      }
      if (response.fertilizer_recommendation) {
        append(
          RecommendationType.FERTILIZER,
          'Fertilizer Recommendation',
          response.fertilizer_recommendation,
        );
      }
      if (response.disease_analysis) {
        append(RecommendationType.DISEASE, 'Disease Analysis', response.disease_analysis);
      }
      if (response.weather_forecast) {
        append(RecommendationType.WEATHER, 'Weather Forecast', response.weather_forecast);
      }
    }

    const soilAnalysis = this.toPlainObject(response.soil_analysis);
    if (Object.keys(soilAnalysis).length > 0) {
      append(RecommendationType.GENERAL, 'Soil Analysis', soilAnalysis);
    }

    if (recommendations.length === 0) {
      append(RecommendationType.GENERAL, 'General Recommendation', response, true);
    }

    return recommendations;
  }

  /** Persist 0–100 model percentages into DECIMAL(5,2); ignore NaN / out-of-range. */
  private normalizeConfidenceScore(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    // Accept 0–1 ratios from older model payloads
    const percent = n > 0 && n <= 1 ? n * 100 : n;
    if (percent < 0 || percent > 999.99) return null;
    return Math.round(percent * 100) / 100;
  }

  private findCategoryBlock(response: PlainObject, keyword: string): PlainObject | null {
    if (!Array.isArray(response.recommendations)) {
      return null;
    }
    for (const block of response.recommendations) {
      const plain = this.toPlainObject(block);
      if (
        typeof plain.category === 'string' &&
        plain.category.toLowerCase().includes(keyword)
      ) {
        return plain;
      }
    }
    return null;
  }

  private groupRecommendationsByType(recommendations: Recommendation[]) {
    return {
      crop: recommendations.filter((item) => item.type === RecommendationType.CROP),
      fertilizer: recommendations.filter(
        (item) => item.type === RecommendationType.FERTILIZER,
      ),
      irrigation: recommendations.filter(
        (item) => item.type === RecommendationType.IRRIGATION,
      ),
      general: recommendations.filter((item) => item.type === RecommendationType.GENERAL),
    };
  }

  private buildTrends(scans: SoilScan[]) {
    if (scans.length < 2) {
      return {
        message: 'Not enough history to compute trends yet',
      };
    }

    const newest = scans[0];
    const oldest = scans[scans.length - 1];

    return {
      sampleSize: scans.length,
      moistureDelta: this.delta(newest.moisture, oldest.moisture),
      phLevelDelta: this.delta(newest.phLevel, oldest.phLevel),
      organicLevelsDelta: this.delta(newest.organicLevels, oldest.organicLevels),
      nitrogenDelta: this.delta(newest.nitrogen, oldest.nitrogen),
      phosphorusDelta: this.delta(newest.phosphorus, oldest.phosphorus),
      potassiumDelta: this.delta(newest.potassium, oldest.potassium),
    };
  }

  private delta(newer: number | null, older: number | null): number | null {
    if (newer == null || older == null) {
      return null;
    }
    return Number(newer) - Number(older);
  }

  private toPlainObject(value: unknown): PlainObject {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as PlainObject;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error while calling model API';
  }
}
