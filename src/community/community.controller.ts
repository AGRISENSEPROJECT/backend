import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Req,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(AuthGuard('jwt'))
export class CommunityController {
    constructor(private readonly communityService: CommunityService) { }

    @Post('posts')
    @ApiOperation({ summary: 'Create a new post' })
    createPost(
        @Req() req,
        @Body() body: { description: string; imageUrl?: string },
    ) {
        return this.communityService.createPost(
            req.user,
            body.description,
            body.imageUrl,
        );
    }

    @Get('posts')
    @ApiOperation({ summary: 'Get all posts' })
    getAllPosts() {
        return this.communityService.getAllPosts();
    }

    @Post('posts/:id/like')
    @ApiOperation({ summary: 'Like or unlike a post' })
    likePost(@Req() req, @Param('id') id: string) {
        return this.communityService.likePost(req.user, id);
    }

    @Post('posts/:id/comment')
    @ApiOperation({ summary: 'Comment on a post' })
    commentOnPost(
        @Req() req,
        @Param('id') id: string,
        @Body() body: { content: string },
    ) {
        return this.communityService.commentOnPost(req.user, id, body.content);
    }
}
