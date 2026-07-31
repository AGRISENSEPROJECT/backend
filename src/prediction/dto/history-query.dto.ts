import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RecommendationType } from '../../entities/recommendation.entity';

export class PredictionHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Optional farm filter' })
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class RecommendationQueryDto extends PredictionHistoryQueryDto {
  @ApiPropertyOptional({
    enum: RecommendationType,
    description: 'Filter by recommendation type',
  })
  @IsOptional()
  @IsEnum(RecommendationType)
  type?: RecommendationType;
}
