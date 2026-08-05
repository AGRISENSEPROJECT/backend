import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { SupplierService } from './supplier.service';
import {
  CreateSupplierProfileDto,
  ListSuppliersQueryDto,
  UpdateSupplierProfileDto,
} from './dto/supplier-profile.dto';

@ApiTags('Suppliers')
@ApiBearerAuth()
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Get('me')
  @Roles(UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Get my supplier profile' })
  @ApiResponse({ status: 200, description: 'Supplier profile retrieved' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getMyProfile(@Req() req: Request) {
    const user = this.getActor(req);
    return this.supplierService.getMyProfile(user.id);
  }

  @Post('profile')
  @Roles(UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Create my supplier business profile' })
  @ApiResponse({ status: 201, description: 'Profile created' })
  @ApiResponse({ status: 409, description: 'Profile already exists' })
  createProfile(@Req() req: Request, @Body() dto: CreateSupplierProfileDto) {
    const user = this.getActor(req);
    return this.supplierService.createProfile(user.id, dto);
  }

  @Put('profile')
  @Roles(UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Update my supplier business profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  updateProfile(@Req() req: Request, @Body() dto: UpdateSupplierProfileDto) {
    const user = this.getActor(req);
    return this.supplierService.updateProfile(user.id, dto);
  }

  @Get()
  @Roles(UserRole.FARMER, UserRole.SUPPLIER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List approved supplier profiles (public catalog)' })
  @ApiResponse({ status: 200, description: 'Approved suppliers retrieved' })
  listApproved(@Query() query: ListSuppliersQueryDto) {
    return this.supplierService.listApprovedProfiles(query);
  }

  @Get(':id')
  @Roles(UserRole.FARMER, UserRole.SUPPLIER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Get a supplier profile by ID (approved public; owner/admin can view pending)',
  })
  @ApiParam({ name: 'id', description: 'Supplier profile ID' })
  @ApiResponse({ status: 200, description: 'Supplier profile retrieved' })
  @ApiResponse({ status: 404, description: 'Supplier profile not found' })
  getById(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const user = this.getActor(req);
    return this.supplierService.getPublicProfile(id, user);
  }
}
