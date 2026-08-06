import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportReason } from '../../entities/post-report.entity';

export class CreatePostDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Great harvest!' })
  @IsString()
  content: string;
}

export class ReportPostDto {
  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'room-uuid' })
  @IsString()
  roomId: string;

  @ApiProperty({ example: 'Hello!' })
  @IsString()
  content: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
