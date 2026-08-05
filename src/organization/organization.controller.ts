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
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { OrganizationService } from './organization.service';
import {
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Get('me')
  @Roles(UserRole.NGO, UserRole.GOVERNMENT)
  @ApiOperation({ summary: 'Get my organization profile' })
  getMine(@Req() req: Request) {
    return this.organizationService.getMyOrganization(this.getActor(req));
  }

  @Post('profile')
  @Roles(UserRole.NGO, UserRole.GOVERNMENT)
  @ApiOperation({ summary: 'Create my NGO/Government organization profile' })
  create(@Req() req: Request, @Body() dto: CreateOrganizationDto) {
    return this.organizationService.createProfile(this.getActor(req), dto);
  }

  @Put('profile')
  @Roles(UserRole.NGO, UserRole.GOVERNMENT)
  @ApiOperation({ summary: 'Update my organization profile' })
  update(@Req() req: Request, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.updateProfile(this.getActor(req), dto);
  }

  @Get()
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'List approved organizations' })
  list(@Query() query: ListOrganizationsQueryDto) {
    return this.organizationService.listApproved(query);
  }

  @Get(':id')
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id' })
  getOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.getById(id, this.getActor(req));
  }
}
