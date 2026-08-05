import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PostReportStatus } from '../../entities/post-report.entity';

export class CreatePostDto {
  @ApiProperty({
    description: 'Post description/content',
    example: 'Just harvested my tomatoes! Great season this year.',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Optional image URL for the post',
    example: 'https://example.com/images/tomato-harvest.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional tags',
    example: ['harvest', 'tomatoes'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment content',
    example: 'Great harvest! What variety of tomatoes did you grow?',
  })
  @IsString()
  content: string;
}

export class ListPostsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ example: 'harvest' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Search in description' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ReportPostDto {
  @ApiProperty({ example: 'spam' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

export class ModerateReportDto {
  @ApiProperty({ enum: PostReportStatus })
  @IsEnum(PostReportStatus)
  status: PostReportStatus;

  @ApiPropertyOptional({
    description: 'When true, hide the reported post',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hidePost?: boolean;
}

export class HidePostDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  hide: boolean;
}
