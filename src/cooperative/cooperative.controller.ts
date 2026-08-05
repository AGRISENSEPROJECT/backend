import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CooperativeService } from './cooperative.service';
import {
  AddMemberDto,
  CreateCooperativeDto,
  UpdateMemberRoleDto,
} from './dto/cooperative.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Cooperatives')
@ApiBearerAuth()
@Controller('cooperatives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CooperativeController {
  constructor(private readonly cooperativeService: CooperativeService) {}

  @Post()
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a cooperative' })
  create(@Req() req, @Body() dto: CreateCooperativeDto) {
    return this.cooperativeService.create(req.user.id, dto);
  }

  @Get()
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'List cooperatives' })
  list() {
    return this.cooperativeService.list();
  }

  @Get(':id')
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get cooperative details and members' })
  get(@Param('id') id: string) {
    return this.cooperativeService.get(id);
  }

  @Post(':id/join')
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Join a cooperative' })
  join(@Req() req, @Param('id') id: string) {
    return this.cooperativeService.join(req.user.id, id);
  }

  @Post(':id/leave')
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Leave a cooperative' })
  leave(@Req() req, @Param('id') id: string) {
    return this.cooperativeService.leave(req.user.id, id);
  }

  @Post(':id/members')
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a member (chair/officer/admin)' })
  addMember(@Req() req, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.cooperativeService.addMember(
      req.user.id,
      req.user.role,
      id,
      dto,
    );
  }

  @Patch(':id/members/:userId')
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update member role' })
  updateMemberRole(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.cooperativeService.updateMemberRole(
      req.user.id,
      req.user.role,
      id,
      userId,
      dto,
    );
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.FARMER, UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a member' })
  removeMember(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.cooperativeService.removeMember(
      req.user.id,
      req.user.role,
      id,
      userId,
    );
  }
}
