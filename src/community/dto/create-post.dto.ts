import { IsString, IsOptional, IsUUID, IsArray, ArrayMinSize, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    description: 'Post text content',
    example: 'Just harvested my tomatoes! Great season this year.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;
}

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment content',
    example: 'Great harvest! What variety of tomatoes did you grow?',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
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

export class SendMessageDto {
  @ApiProperty({ description: 'Message text' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class SearchUsersQueryDto {
  @ApiPropertyOptional({ description: 'Search by username or email' })
  @IsOptional()
  @IsString()
  q?: string;
}
