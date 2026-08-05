import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { AdminService } from './admin.service';
import {
  AdminUsersQueryDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/admin-user.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  @ApiResponse({ status: 200, description: 'Platform stats retrieved' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users with optional filters' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update user status (active/pending/suspended)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  updateUserStatus(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const actor = this.getActor(req);
    return this.adminService.updateUserStatus(actor.id, id, dto);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User role updated' })
  updateUserRole(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const actor = this.getActor(req);
    return this.adminService.updateUserRole(actor.id, id, dto);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List supplier accounts' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: UserStatus,
    description: 'Filter by status (e.g. pending for approval queue)',
  })
  @ApiResponse({ status: 200, description: 'Suppliers retrieved' })
  listSuppliers(@Query('status') status?: UserStatus) {
    return this.adminService.listSuppliers(status);
  }

  @Post('suppliers/:id/approve')
  @ApiOperation({ summary: 'Approve a pending supplier' })
  @ApiParam({ name: 'id', description: 'Supplier user ID' })
  @ApiResponse({ status: 200, description: 'Supplier approved' })
  approveSupplier(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.approveSupplier(id);
  }

  @Post('suppliers/:id/reject')
  @ApiOperation({ summary: 'Reject a supplier (sets status to suspended)' })
  @ApiParam({ name: 'id', description: 'Supplier user ID' })
  @ApiResponse({ status: 200, description: 'Supplier rejected' })
  rejectSupplier(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.rejectSupplier(id);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List NGO and Government accounts' })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: [UserRole.NGO, UserRole.GOVERNMENT],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: UserStatus,
  })
  listOrganizations(
    @Query('role') role?: UserRole.NGO | UserRole.GOVERNMENT,
    @Query('status') status?: UserStatus,
  ) {
    return this.adminService.listOrganizations(role, status);
  }

  @Post('organizations/:id/approve')
  @ApiOperation({ summary: 'Approve NGO or Government organization' })
  @ApiParam({ name: 'id', description: 'Organization user ID' })
  approveOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.approveOrganization(id);
  }

  @Post('organizations/:id/reject')
  @ApiOperation({ summary: 'Reject NGO or Government organization' })
  @ApiParam({ name: 'id', description: 'Organization user ID' })
  rejectOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.rejectOrganization(id);
  }
}
