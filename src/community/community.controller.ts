import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { CommunityService } from './community.service';
import { CreatePostDto, CreateCommentDto, ReportPostDto, SendMessageDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CloudinaryService } from '../auth/cloudinary.service';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(AuthGuard('jwt'))
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('posts')
  @ApiOperation({ summary: 'Create a community post' })
  createPost(@Req() req, @Body() dto: CreatePostDto) {
    return this.communityService.createPost(req.user, dto.description, dto.imageUrl);
  }

  @Post('posts/upload')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create post with image upload' })
  async createPostWithImage(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description?: string,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    return this.communityService.createPost(req.user, description, imageUrl);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get community posts (paginated)' })
  getAllPosts(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.communityService.getAllPosts(page || 1, limit || 20);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get single post' })
  getPost(@Param('id') id: string) {
    return this.communityService.getPostById(id);
  }

  @Put('posts/:id')
  @ApiOperation({ summary: 'Edit own post' })
  editPost(@Req() req, @Param('id') id: string, @Body() dto: CreatePostDto) {
    return this.communityService.editPost(req.user, id, dto.description, dto.imageUrl);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete own post (or admin)' })
  deletePost(@Req() req, @Param('id') id: string) {
    return this.communityService.deletePost(req.user, id);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Like or unlike a post' })
  likePost(@Req() req, @Param('id') id: string) {
    return this.communityService.likePost(req.user, id);
  }

  @Post('posts/:id/comment')
  @ApiOperation({ summary: 'Comment on a post' })
  commentOnPost(@Req() req, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.communityService.commentOnPost(req.user, id, dto.content);
  }

  @Post('posts/:id/report')
  @ApiOperation({ summary: 'Report a post' })
  reportPost(@Req() req, @Param('id') id: string, @Body() dto: ReportPostDto) {
    return this.communityService.reportPost(req.user, id, dto);
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pending reports (admin only)' })
  getReports(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.communityService.getReports(page || 1, limit || 20);
  }

  @Post('posts/:id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Moderate a reported post (admin only)' })
  moderatePost(@Param('id') id: string, @Body('action') action: 'hide' | 'dismiss') {
    return this.communityService.moderatePost(id, action);
  }

  @Post('chat/messages')
  @ApiOperation({ summary: 'Send a chat message' })
  sendMessage(@Req() req, @Body() dto: SendMessageDto) {
    return this.communityService.sendMessage(req.user, dto.roomId, dto.content, dto.imageUrl);
  }

  @Post('chat/upload')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Send chat message with image' })
  async sendMessageWithImage(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('roomId') roomId: string,
    @Body('content') content?: string,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    return this.communityService.sendMessage(req.user, roomId, content || '', imageUrl);
  }

  @Get('chat/:roomId/messages')
  @ApiOperation({ summary: 'Get chat messages for a room' })
  getChatMessages(
    @Param('roomId') roomId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.communityService.getChatMessages(roomId, page || 1, limit || 50);
  }
}
