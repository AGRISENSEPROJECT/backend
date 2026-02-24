import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Optional farm filter' })
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @ApiPropertyOptional({ description: 'Number of latest runs to return', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
