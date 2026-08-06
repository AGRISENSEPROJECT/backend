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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { AuditAction } from '../entities/audit-log.entity';
import {
  CreateUserDto,
  CreateSupplierAccountDto,
  CreateNgoAccountDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  AssignRegionsDto,
  ApprovalDto,
  BroadcastDto,
  AdminResetPasswordDto,
  ModeratePostDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private actorId(req: Request) {
    return (req.user as any)?.id as string;
  }

  @Post('users')
  @ApiOperation({ summary: 'Create user (non-farmer, non-admin roles)' })
  createUser(@Req() req: Request, @Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto, this.actorId(req));
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create supplier account (optionally auto-approved)' })
  @ApiBody({ type: CreateSupplierAccountDto })
  createSupplier(@Req() req: Request, @Body() dto: CreateSupplierAccountDto) {
    return this.adminService.createSupplierAccount(dto, this.actorId(req));
  }

  @Post('ngos')
  @ApiOperation({ summary: 'Create NGO account (optionally auto-approved)' })
  @ApiBody({ type: CreateNgoAccountDto })
  createNgo(@Req() req: Request, @Body() dto: CreateNgoAccountDto) {
    return this.adminService.createNgoAccount(dto, this.actorId(req));
  }

  @Get('users')
  @ApiOperation({ summary: 'List/search/filter users' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'includeDeleted', required: false })
  getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.adminService.getAllUsers(
      page || 1,
      limit || 20,
      role,
      status,
      search,
      includeDeleted === 'true',
    );
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id/status')
  @ApiOperation({
    summary: 'Update user status (cannot suspend/ban self or other admins)',
  })
  updateUserStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto, this.actorId(req));
  }

  @Put('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend user (blocked for self/other admins)' })
  suspendUser(@Req() req: Request, @Param('id') id: string) {
    return this.adminService.suspendUser(id, this.actorId(req));
  }

  @Put('users/:id/ban')
  @ApiOperation({ summary: 'Ban user (blocked for self/other admins)' })
  banUser(@Req() req: Request, @Param('id') id: string) {
    return this.adminService.banUser(id, this.actorId(req));
  }

  @Put('users/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate suspended/banned user' })
  reactivateUser(@Req() req: Request, @Param('id') id: string) {
    return this.adminService.reactivateUser(id, this.actorId(req));
  }

  @Put('users/:id/verify-email')
  @ApiOperation({ summary: 'Force-verify a user email' })
  forceVerifyEmail(@Req() req: Request, @Param('id') id: string) {
    return this.adminService.forceVerifyEmail(id, this.actorId(req));
  }

  @Put('users/:id/reset-password')
  @ApiOperation({ summary: 'Admin reset of a non-admin user password' })
  resetPassword(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
  ) {
    return this.adminService.resetUserPassword(id, dto, this.actorId(req));
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role (cannot change admin roles)' })
  updateUserRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto, this.actorId(req));
  }

  @Put('users/:id/regions')
  assignRegions(@Param('id') id: string, @Body() dto: AssignRegionsDto) {
    return this.adminService.assignRegions(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Soft delete user (blocked for self/other admins)' })
  softDeleteUser(@Req() req: Request, @Param('id') id: string) {
    return this.adminService.softDeleteUser(id, this.actorId(req));
  }

  @Put('users/:id/restore')
  @ApiOperation({ summary: 'Restore soft-deleted user' })
  restoreUser(@Req() req: Request, @Param('id') id: string) {
    return this.adminService.restoreUser(id, this.actorId(req));
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List all supplier profiles' })
  listSuppliers(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listSuppliers(page || 1, limit || 20);
  }

  @Get('suppliers/pending')
  getPendingSuppliers() {
    return this.adminService.getPendingSuppliers();
  }

  @Put('suppliers/:id/approve')
  approveSupplier(@Param('id') id: string) {
    return this.adminService.approveSupplier(id);
  }

  @Put('suppliers/:id/reject')
  rejectSupplier(@Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.adminService.rejectSupplier(id, dto);
  }

  @Get('ngos')
  @ApiOperation({ summary: 'List all NGO organizations' })
  listNgos(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listNgos(page || 1, limit || 20);
  }

  @Get('ngos/pending')
  getPendingNgos() {
    return this.adminService.getPendingNgos();
  }

  @Put('ngos/:id/approve')
  approveNgo(@Param('id') id: string) {
    return this.adminService.approveNgo(id);
  }

  @Put('ngos/:id/reject')
  rejectNgo(@Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.adminService.rejectNgo(id, dto);
  }

  @Post('announcements')
  @ApiOperation({ summary: 'Broadcast platform announcement' })
  broadcast(@Body() dto: BroadcastDto) {
    return this.adminService.broadcastAnnouncement(dto);
  }

  @Get('posts/reported')
  @ApiOperation({ summary: 'List reported/hidden community posts' })
  getReportedPosts(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getReportedPosts(page || 1, limit || 20);
  }

  @Put('posts/:id/moderate')
  @ApiOperation({ summary: 'Hide, unhide, or delete a community post' })
  moderatePost(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ModeratePostDto,
  ) {
    return this.adminService.moderatePost(id, dto, this.actorId(req));
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'View audit logs (cannot be deleted)' })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction })
  getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: AuditAction,
  ) {
    return this.adminService.getAuditLogs(page || 1, limit || 50, action);
  }

  @Get('statistics/overview')
  @ApiOperation({ summary: 'Platform overview dashboard stats' })
  getPlatformOverview() {
    return this.adminService.getPlatformOverview();
  }

  @Get('statistics/farms')
  getFarmStatistics() {
    return this.adminService.getFarmStatistics();
  }

  @Get('farms')
  getAllFarms(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAllFarms(page || 1, limit || 20);
  }
}
