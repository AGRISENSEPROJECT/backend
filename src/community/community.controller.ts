import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CommunityService } from './community.service';
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  UpdateCommentDto,
  ReactPostDto,
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  UpdateGroupDto,
  GroupMembersDto,
  SendMessageDto,
  MuteConversationDto,
  BlockUserDto,
  ReportPostDto,
} from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(AuthGuard('jwt'))
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ─── Feed ───────────────────────────────────────────────────────────────

  @Post('posts')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a community post with one cover image' })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: 'Post created' })
  createPost(
    @Req() req,
    @Body() dto: CreatePostDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    if (!image) {
      throw new BadRequestException(
        'A cover image is required. Send multipart field "image".',
      );
    }
    return this.communityService.createPost(
      req.user,
      dto.title,
      dto.description,
      image,
    );
  }

  @Get('posts')
  @ApiOperation({ summary: 'List / search community posts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Search text' })
  @ApiQuery({ name: 'hashtag', required: false })
  getAllPosts(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('hashtag') hashtag?: string,
  ) {
    return this.communityService.getAllPosts(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
      q,
      hashtag,
    );
  }

  @Patch('posts/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Edit your own post (optional new cover image)' })
  @ApiBody({ type: UpdatePostDto })
  updatePost(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.communityService.updatePost(
      req.user,
      id,
      dto.description,
      image,
      dto.title,
    );
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete your own post' })
  @ApiParam({ name: 'id' })
  deletePost(@Req() req, @Param('id') id: string) {
    return this.communityService.deletePost(req.user, id);
  }

  @Post('posts/:id/share')
  @ApiOperation({ summary: 'Get a share payload for a post' })
  sharePost(@Req() req, @Param('id') id: string) {
    return this.communityService.sharePost(req.user, id);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Like or unlike a post' })
  @ApiParam({ name: 'id' })
  likePost(@Req() req, @Param('id') id: string) {
    return this.communityService.likePost(req.user, id);
  }

  @Post('posts/:id/react')
  @ApiOperation({ summary: 'Toggle a reaction on a post' })
  @ApiBody({ type: ReactPostDto })
  reactPost(@Req() req, @Param('id') id: string, @Body() dto: ReactPostDto) {
    return this.communityService.reactToPost(req.user, id, dto.type || 'like');
  }

  @Post('posts/:id/comment')
  @ApiOperation({ summary: 'Comment or reply on a post' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CreateCommentDto })
  commentOnPost(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.commentOnPost(
      req.user,
      id,
      dto.content,
      dto.parentId,
    );
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Edit your own comment' })
  @ApiBody({ type: UpdateCommentDto })
  updateComment(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.communityService.updateComment(req.user, id, dto.content);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete your own comment' })
  @ApiParam({ name: 'id' })
  deleteComment(@Req() req, @Param('id') id: string) {
    return this.communityService.deleteComment(req.user, id);
  }

  // ─── Blocks ─────────────────────────────────────────────────────────────

  @Get('blocks')
  @ApiOperation({ summary: 'List users you blocked' })
  listBlocks(@Req() req) {
    return this.communityService.listBlockedUsers(req.user);
  }

  @Post('blocks')
  @ApiOperation({ summary: 'Block a user' })
  @ApiBody({ type: BlockUserDto })
  blockUser(@Req() req, @Body() dto: BlockUserDto) {
    return this.communityService.blockUser(req.user, dto.userId);
  }

  @Delete('blocks/:userId')
  @ApiOperation({ summary: 'Unblock a user' })
  unblockUser(@Req() req, @Param('userId') userId: string) {
    return this.communityService.unblockUser(req.user, userId);
  }

  // ─── Users / messaging ─────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'Search users to start a chat' })
  @ApiQuery({ name: 'q', required: false })
  searchUsers(@Req() req, @Query('q') q?: string) {
    return this.communityService.searchUsers(req.user.id, q);
  }

  @Get('presence')
  @ApiOperation({ summary: 'List currently online user IDs' })
  getPresence() {
    return { onlineUserIds: this.communityService.getOnlineUserIds() };
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

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename a group conversation' })
  @ApiBody({ type: UpdateGroupDto })
  renameGroup(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    if (!dto.name) {
      return this.communityService.getConversation(req.user, id);
    }
    return this.communityService.renameGroup(req.user, id, dto.name);
  }

  @Post('conversations/:id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace a group profile image (creator only)' })
  updateGroupImage(
    @Req() req,
    @Param('id') id: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    if (!image) {
      throw new BadRequestException('Send multipart field "image".');
    }
    return this.communityService.updateGroupImage(req.user, id, image);
  }

  @Post('conversations/:id/members')
  @ApiOperation({ summary: 'Add members to a group' })
  @ApiBody({ type: GroupMembersDto })
  addMembers(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: GroupMembersDto,
  ) {
    return this.communityService.addGroupMembers(
      req.user,
      id,
      dto.memberIds,
    );
  }

  @Delete('conversations/:id/members')
  @ApiOperation({ summary: 'Remove members from a group' })
  @ApiBody({ type: GroupMembersDto })
  removeMembers(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: GroupMembersDto,
  ) {
    return this.communityService.removeGroupMembers(
      req.user,
      id,
      dto.memberIds,
    );
  }

  @Post('conversations/:id/leave')
  @ApiOperation({ summary: 'Leave a conversation' })
  leave(@Req() req, @Param('id') id: string) {
    return this.communityService.leaveConversation(req.user, id);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a group (creator only)' })
  deleteGroup(@Req() req, @Param('id') id: string) {
    return this.communityService.deleteGroup(req.user, id);
  }

  @Post('conversations/:id/mute')
  @ApiOperation({ summary: 'Mute or unmute a conversation' })
  @ApiBody({ type: MuteConversationDto })
  mute(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: MuteConversationDto,
  ) {
    return this.communityService.muteConversation(
      req.user,
      id,
      dto.muted !== false,
    );
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

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Soft-delete your own message' })
  deleteMessage(@Req() req, @Param('id') id: string) {
    return this.communityService.deleteMessage(req.user, id);
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Edit your own message' })
  @ApiBody({ type: SendMessageDto })
  updateMessage(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.communityService.updateMessage(req.user, id, dto.content);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read (per-message receipts)' })
  markRead(@Req() req, @Param('id') id: string) {
    return this.communityService.markConversationRead(req.user, id);
  }

  @Post('posts/:id/report')
  @ApiOperation({ summary: 'Report a post' })
  @ApiBody({ type: ReportPostDto })
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
}
