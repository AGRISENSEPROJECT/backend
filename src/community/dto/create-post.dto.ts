import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment content',
    example: 'Great harvest! What variety of tomatoes did you grow?',
  })
  @IsString()
  content: string;
}