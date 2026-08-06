import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { AuditAction } from '../entities/audit-log.entity';
import {
  CreateUserDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  AssignRegionsDto,
  ApprovalDto,
  BroadcastDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('users')
  @ApiOperation({ summary: 'Create user (non-farmer roles)' })
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'List/search/filter users' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'search', required: false })
  getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllUsers(page || 1, limit || 20, role, status, search);
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id/status')
  updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, dto);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminService.updateUserRole(id, dto);
  }

  @Put('users/:id/regions')
  assignRegions(@Param('id') id: string, @Body() dto: AssignRegionsDto) {
    return this.adminService.assignRegions(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Soft delete user' })
  softDeleteUser(@Param('id') id: string) {
    return this.adminService.softDeleteUser(id);
  }

  @Put('users/:id/restore')
  @ApiOperation({ summary: 'Restore soft-deleted user' })
  restoreUser(@Param('id') id: string) {
    return this.adminService.restoreUser(id);
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

  @Get('statistics/farms')
  getFarmStatistics() {
    return this.adminService.getFarmStatistics();
  }

  @Get('farms')
  getAllFarms(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAllFarms(page || 1, limit || 20);
  }
}
