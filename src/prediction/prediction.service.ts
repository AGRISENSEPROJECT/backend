import {
  BadGatewayException,
  Injectable,
  NotFoundException,
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

type PlainObject = Record<string, unknown>;
type ModelPayload = {
  temperature: number;
  humidity: number;
  rainfall: number;
  cropType: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
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
          }),
        );

        await this.recommendationRepository.save(recommendationEntities);
      }

      return {
        message: 'Prediction completed and stored successfully',
        predictionRunId: predictionRun.id,
        soilScan,
        summary,
        recommendations,
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

  private buildModelPayload(dto: CreatePredictionDto, soilScan: SoilScan): PlainObject {
    return {
      temperature: Number(soilScan.temperature),
      humidity: Number(soilScan.moisture),
      rainfall: Number(dto.rainfall),
      cropType: dto.crop_type,
      nitrogen: Number(soilScan.nitrogen),
      phosphorus: Number(soilScan.phosphorus),
      potassium: Number(soilScan.potassium),
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
    formData.append('crop_type', modelPayload.cropType);
    formData.append('nitrogen', String(modelPayload.nitrogen));
    formData.append('phosphorus', String(modelPayload.phosphorus));
    formData.append('potassium', String(modelPayload.potassium));

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
    const cropRecommendations = Array.isArray(response.crop_recommendations)
      ? response.crop_recommendations
      : [];
    const primaryCrop = this.toPlainObject(cropRecommendations[0]);

    return {
      bestCrop: primaryCrop.crop ?? null,
      soilTexture: response.soil_texture ?? null,
      fertilizer:
        response.fertilizer_recommendation ??
        response.fertilizerRecommendation ??
        response.fertilizer ??
        null,
      confidence: primaryCrop.suitability_score ?? null,
    };
  }

  private extractRecommendations(
    rawResponse: unknown,
  ): Array<{
    type: RecommendationType;
    title: string;
    payload: PlainObject;
    rank: number;
    isPrimary: boolean;
  }> {
    const response = this.toPlainObject(rawResponse);
    const recommendations: Array<{
      type: RecommendationType;
      title: string;
      payload: PlainObject;
      rank: number;
      isPrimary: boolean;
    }> = [];

    const append = (
      type: RecommendationType,
      title: string,
      payload: unknown,
      rank: number,
      isPrimary = false,
    ) => {
      recommendations.push({
        type,
        title,
        payload: this.toPlainObject(payload),
        rank,
        isPrimary,
      });
    };

    const list = Array.isArray(response.crop_recommendations)
      ? response.crop_recommendations
      : Array.isArray(response.recommendations)
        ? response.recommendations
        : [];

    if (list.length > 0) {
      list.forEach((item, index) => {
        const plain = this.toPlainObject(item);
        append(
          RecommendationType.CROP,
          String(plain.crop ?? plain.title ?? `Crop Recommendation ${index + 1}`),
          plain,
          Number(plain.rank ?? index),
          Boolean(plain.isPrimary ?? index === 0),
        );
      });
    }

    if (response.fertilizer_recommendation || response.fertilizerRecommendation) {
      const fertilizerPayload = this.toPlainObject(
        response.fertilizer_recommendation ?? response.fertilizerRecommendation,
      );
      append(
        RecommendationType.FERTILIZER,
        'Fertilizer Recommendation',
        fertilizerPayload,
        recommendations.length,
        recommendations.length === 0,
      );
    }

    if (response.cropRecommendation || response.bestCrop || response.best_crop) {
      append(
        RecommendationType.CROP,
        'Crop Recommendation',
        {
          cropRecommendation:
            response.cropRecommendation ?? response.bestCrop ?? response.best_crop,
          alternatives: response.alternativeCrops ?? response.alternatives ?? null,
          growthScore: response.growthScore ?? null,
          bestPlantingSeason: response.bestPlantingSeason ?? null,
          soilSuitability: response.soilSuitability ?? null,
        },
        0,
        true,
      );
    }

    if (response.soil_texture) {
      append(
        RecommendationType.GENERAL,
        'Soil Texture',
        {
          soilTexture: response.soil_texture,
        },
        recommendations.length,
      );
    }

    if (recommendations.length === 0) {
      append(RecommendationType.GENERAL, 'General Recommendation', response, 0, true);
    }

    return recommendations;
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
