import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMinSize,
  MinLength,
  MaxLength,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreatePostDto {
  @ApiProperty({
    description: 'Short title shown on dashboard cards',
    example: 'Tomato harvest tips this week',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiProperty({
    description: 'Post body (supports @mentions and #hashtags)',
    example: 'Just harvested my tomatoes! @jane #harvest',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Single cover image for the post (JPEG/PNG/WebP, max 5MB)',
  })
  @IsOptional()
  image?: any;
}

export class UpdatePostDto {
  @ApiPropertyOptional({ description: 'Updated short title' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ApiProperty({ description: 'Updated post text' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;
}

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment content',
    example: 'Great harvest!',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({
    description: 'Parent comment ID for a nested reply',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiProperty({ description: 'Updated comment text' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}

export class ReactPostDto {
  @ApiProperty({
    enum: ['like', 'helpful', 'celebrate'],
    default: 'like',
  })
  @IsOptional()
  @IsIn(['like', 'helpful', 'celebrate'])
  type?: 'like' | 'helpful' | 'celebrate' = 'like';
}

export class CreateDirectConversationDto {
  @ApiProperty({ description: 'Other user ID for a direct chat' })
  @IsUUID()
  userId: string;
}

export class CreateGroupConversationDto {
  @ApiProperty({ description: 'Group name', example: 'East Region Growers' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({
    description: 'Member user IDs (creator is added automatically)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberIds: string[];
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ description: 'New group name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}

export class GroupMembersDto {
  @ApiProperty({ type: [String], description: 'User IDs to add or remove' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberIds: string[];
}

export class SendMessageDto {
  @ApiProperty({ description: 'Message text' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class MuteConversationDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  muted?: boolean = true;
}

export class SearchUsersQueryDto {
  @ApiPropertyOptional({ description: 'Search by username or email' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class BlockUserDto {
  @ApiProperty({ description: 'User ID to block' })
  @IsUUID()
  userId: string;
}
