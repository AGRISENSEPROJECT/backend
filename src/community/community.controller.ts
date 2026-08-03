import {
  Controller,
  Get,
  Post,
  Delete,
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
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CommunityService } from './community.service';
import {
  CreatePostDto,
  CreateCommentDto,
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  SendMessageDto,
} from './dto/create-post.dto';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(AuthGuard('jwt'))
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ─── Feed ───────────────────────────────────────────────────────────────

  @Post('posts')
  @ApiOperation({ summary: 'Create a text community post' })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: 'Post created' })
  createPost(@Req() req, @Body() dto: CreatePostDto) {
    return this.communityService.createPost(req.user, dto.description);
  }

  @Get('posts')
  @ApiOperation({ summary: 'List community posts (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAllPosts(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communityService.getAllPosts(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete your own post' })
  @ApiParam({ name: 'id' })
  deletePost(@Req() req, @Param('id') id: string) {
    return this.communityService.deletePost(req.user, id);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Like or unlike a post' })
  @ApiParam({ name: 'id' })
  likePost(@Req() req, @Param('id') id: string) {
    return this.communityService.likePost(req.user, id);
  }

  @Post('posts/:id/comment')
  @ApiOperation({ summary: 'Comment on a post' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CreateCommentDto })
  commentOnPost(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.commentOnPost(req.user, id, dto.content);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete your own comment' })
  @ApiParam({ name: 'id' })
  deleteComment(@Req() req, @Param('id') id: string) {
    return this.communityService.deleteComment(req.user, id);
  }

  // ─── Users / messaging ─────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'Search users to start a chat' })
  @ApiQuery({ name: 'q', required: false })
  searchUsers(@Req() req, @Query('q') q?: string) {
    return this.communityService.searchUsers(req.user.id, q);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List your conversations' })
  @ApiQuery({ name: 'type', required: false, enum: ['direct', 'group'] })
  listConversations(@Req() req, @Query('type') type?: 'direct' | 'group') {
    return this.communityService.listConversations(req.user, type);
  }

  @Post('conversations/direct')
  @ApiOperation({ summary: 'Start or open a direct chat' })
  @ApiBody({ type: CreateDirectConversationDto })
  createDirect(@Req() req, @Body() dto: CreateDirectConversationDto) {
    return this.communityService.createDirectConversation(req.user, dto.userId);
  }

  @Post('conversations/group')
  @ApiOperation({ summary: 'Create a group chat' })
  @ApiBody({ type: CreateGroupConversationDto })
  createGroup(@Req() req, @Body() dto: CreateGroupConversationDto) {
    return this.communityService.createGroupConversation(
      req.user,
      dto.name,
      dto.memberIds,
    );
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get one conversation' })
  getConversation(@Req() req, @Param('id') id: string) {
    return this.communityService.getConversation(req.user, id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMessages(
    @Req() req,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communityService.getMessages(
      req.user,
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiBody({ type: SendMessageDto })
  sendMessage(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.communityService.sendMessage(req.user, id, dto.content);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  markRead(@Req() req, @Param('id') id: string) {
    return this.communityService.markConversationRead(req.user, id);
  }
}
