import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CommunityService } from './community.service';
import { CreatePostDto, CreateCommentDto } from './dto/create-post.dto';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(AuthGuard('jwt'))
export class CommunityController {
    constructor(private readonly communityService: CommunityService) { }

    @Post('posts')
    @ApiOperation({ summary: 'Create a new community post' })
    @ApiBody({ type: CreatePostDto })
    @ApiResponse({
        status: 201,
        description: 'Post created successfully',
        schema: {
            example: {
                id: 'uuid-string',
                description: 'Just harvested my tomatoes! Great season this year.',
                imageUrl: 'https://example.com/images/tomato-harvest.jpg',
                author: {
                    id: 'user-uuid',
                    username: 'farmer_john',
                    email: 'john@example.com',
                },
                likes: [],
                comments: [],
                createdAt: '2023-01-01T00:00:00.000Z',
                updatedAt: '2023-01-01T00:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    createPost(
        @Req() req,
        @Body() createPostDto: CreatePostDto,
    ) {
        return this.communityService.createPost(
            req.user,
            createPostDto.description,
            createPostDto.imageUrl,
        );
    }

    @Get('posts')
    @ApiOperation({ summary: 'Get all community posts' })
    @ApiResponse({
        status: 200,
        description: 'Posts retrieved successfully',
        schema: {
            example: [
                {
                    id: 'uuid-string',
                    description: 'Just harvested my tomatoes! Great season this year.',
                    imageUrl: 'https://example.com/images/tomato-harvest.jpg',
                    author: {
                        id: 'user-uuid',
                        username: 'farmer_john',
                        email: 'john@example.com',
                    },
                    likes: [
                        {
                            id: 'like-uuid',
                            user: {
                                id: 'user-uuid-2',
                                username: 'farmer_jane',
                            },
                        },
                    ],
                    comments: [
                        {
                            id: 'comment-uuid',
                            content: 'Great harvest! What variety did you grow?',
                            author: {
                                id: 'user-uuid-2',
                                username: 'farmer_jane',
                            },
                            createdAt: '2023-01-01T00:00:00.000Z',
                        },
                    ],
                    createdAt: '2023-01-01T00:00:00.000Z',
                    updatedAt: '2023-01-01T00:00:00.000Z',
                },
            ],
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getAllPosts() {
        return this.communityService.getAllPosts();
    }

    @Post('posts/:id/like')
    @ApiOperation({ summary: 'Like or unlike a post' })
    @ApiParam({
        name: 'id',
        description: 'Post ID',
        example: 'uuid-string',
    })
    @ApiResponse({
        status: 201,
        description: 'Post liked/unliked successfully',
        schema: {
            example: {
                id: 'like-uuid',
                user: {
                    id: 'user-uuid',
                    username: 'farmer_john',
                },
                post: {
                    id: 'post-uuid',
                    description: 'Post description',
                },
                createdAt: '2023-01-01T00:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Post not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    likePost(@Req() req, @Param('id') id: string) {
        return this.communityService.likePost(req.user, id);
    }

    @Post('posts/:id/comment')
    @ApiOperation({ summary: 'Add a comment to a post' })
    @ApiParam({
        name: 'id',
        description: 'Post ID',
        example: 'uuid-string',
    })
    @ApiBody({ type: CreateCommentDto })
    @ApiResponse({
        status: 201,
        description: 'Comment added successfully',
        schema: {
            example: {
                id: 'comment-uuid',
                content: 'Great harvest! What variety of tomatoes did you grow?',
                author: {
                    id: 'user-uuid',
                    username: 'farmer_john',
                    email: 'john@example.com',
                },
                post: {
                    id: 'post-uuid',
                    description: 'Post description',
                },
                createdAt: '2023-01-01T00:00:00.000Z',
                updatedAt: '2023-01-01T00:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Post not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    commentOnPost(
        @Req() req,
        @Param('id') id: string,
        @Body() createCommentDto: CreateCommentDto,
    ) {
        return this.communityService.commentOnPost(req.user, id, createCommentDto.content);
    }
}
