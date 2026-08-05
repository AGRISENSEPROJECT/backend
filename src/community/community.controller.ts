import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CommunityService } from './community.service';
import {
  CreatePostDto,
  CreateCommentDto,
  ListPostsQueryDto,
  ReportPostDto,
  ModerateReportDto,
  HidePostDto,
} from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { PostReportStatus } from '../entities/post-report.entity';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post('posts')
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new community post' })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({
    status: 201,
    description: 'Post created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden for this role' })
  createPost(@Req() req, @Body() createPostDto: CreatePostDto) {
    return this.communityService.createPost(
      req.user,
      createPostDto.description,
      createPostDto.imageUrl,
      createPostDto.tags,
    );
  }

  @Get('posts')
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get community posts (paginated, filterable)' })
  @ApiResponse({
    status: 200,
    description: 'Posts retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAllPosts(@Req() req, @Query() query: ListPostsQueryDto) {
    return this.communityService.getAllPosts(query, req.user.role);
  }

  @Post('posts/:id/like')
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Like or unlike a post' })
  @ApiParam({
    name: 'id',
    description: 'Post ID',
    example: 'uuid-string',
  })
  @ApiResponse({ status: 201, description: 'Post liked/unliked successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden for this role' })
  likePost(@Req() req, @Param('id') id: string) {
    return this.communityService.likePost(req.user, id);
  }

  @Post('posts/:id/comment')
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiParam({
    name: 'id',
    description: 'Post ID',
    example: 'uuid-string',
  })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden for this role' })
  commentOnPost(
    @Req() req,
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.communityService.commentOnPost(
      req.user,
      id,
      createCommentDto.content,
    );
  }

  @Post('posts/:id/report')
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Report a community post' })
  reportPost(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.communityService.reportPost(req.user, id, dto);
  }

  @Get('reports')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List post reports (admin)' })
  listReports(
    @Query('status') status?: PostReportStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.communityService.listReports(
      status,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Patch('reports/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Moderate a post report (admin)' })
  moderateReport(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: ModerateReportDto,
  ) {
    return this.communityService.moderateReport(req.user, id, dto);
  }

  @Patch('posts/:id/visibility')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Hide or unhide a post (admin)' })
  setVisibility(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: HidePostDto,
  ) {
    return this.communityService.setPostHidden(req.user, id, dto.hide);
  }
}
