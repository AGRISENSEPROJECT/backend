import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RegionalService } from './regional.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateProgramDto, UpdateProgramDto, UpdateNgoProfileDto } from './dto/ngo.dto';
import { CreateAdvisoryDto, UpdateAdvisoryDto } from './dto/government.dto';

@ApiTags('NGO')
@ApiBearerAuth()
@Controller('ngo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.NGO)
export class NgoController {
  constructor(private readonly regionalService: RegionalService) {}

  @Get('profile')
  getProfile(@Req() req) {
    return this.regionalService.getNgoProfile(req.user.id);
  }

  @Put('profile')
  updateProfile(@Req() req, @Body() dto: UpdateNgoProfileDto) {
    return this.regionalService.updateNgoProfile(req.user.id, dto);
  }

  @Get('statistics')
  getStats(@Req() req) {
    return this.regionalService.getRegionalFarmStats(req.user);
  }

  @Get('farms')
  getFarms(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number, @Query('province') province?: string) {
    return this.regionalService.getRegionalFarms(req.user, page || 1, limit || 20, province);
  }

  @Get('predictions')
  getPredictions(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.regionalService.getRegionalPredictions(req.user, page || 1, limit || 20);
  }

  @Get('farmers')
  getFarmers(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.regionalService.getRegionalFarmers(req.user, page || 1, limit || 20);
  }

  @Get('disease-trends')
  @ApiOperation({ summary: 'Monitor disease outbreaks by region' })
  getDiseaseTrends(@Req() req) {
    return this.regionalService.getDiseaseTrends(req.user);
  }

  @Post('programs')
  createProgram(@Req() req, @Body() dto: CreateProgramDto) {
    return this.regionalService.createProgram(req.user.id, dto);
  }

  @Get('programs')
  getPrograms(@Req() req) {
    return this.regionalService.getPrograms(req.user.id);
  }

  @Put('programs/:id')
  updateProgram(@Req() req, @Param('id') id: string, @Body() dto: UpdateProgramDto) {
    return this.regionalService.updateProgram(req.user.id, id, dto);
  }

  @Get('reports/export')
  @ApiOperation({ summary: 'Export regional report' })
  exportReport(@Req() req) {
    return this.regionalService.exportRegionalReport(req.user);
  }

  @Post('notifications')
  sendNotification(
    @Req() req,
    @Body() body: { title: string; message: string; targetUserIds: string[] },
  ) {
    return this.regionalService.sendProgramNotification(req.user.id, body.title, body.message, body.targetUserIds);
  }
}

@ApiTags('Government')
@ApiBearerAuth()
@Controller('government')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GOVERNMENT)
export class GovernmentController {
  constructor(private readonly regionalService: RegionalService) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Nationwide agricultural statistics' })
  getNationalStats(@Req() req) {
    return this.regionalService.getNationalStatistics(req.user);
  }

  @Get('statistics/regional')
  getRegionalStats(@Req() req) {
    return this.regionalService.getRegionalFarmStats(req.user);
  }

  @Get('farms')
  getFarms(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number, @Query('province') province?: string) {
    return this.regionalService.getRegionalFarms(req.user, page || 1, limit || 20, province);
  }

  @Get('predictions')
  getPredictions(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.regionalService.getRegionalPredictions(req.user, page || 1, limit || 20);
  }

  @Get('disease-trends')
  @ApiOperation({ summary: 'Monitor disease outbreaks nationwide' })
  getDiseaseTrends(@Req() req) {
    return this.regionalService.getDiseaseTrends(req.user);
  }

  @Post('advisories')
  @ApiOperation({ summary: 'Publish government advisory or alert' })
  createAdvisory(@Req() req, @Body() dto: CreateAdvisoryDto) {
    return this.regionalService.createAdvisory(req.user.id, dto);
  }

  @Get('advisories')
  getAdvisories(@Query('regions') regions?: string) {
    const regionList = regions ? regions.split(',') : undefined;
    return this.regionalService.getAdvisories(regionList);
  }

  @Put('advisories/:id')
  updateAdvisory(@Req() req, @Param('id') id: string, @Body() dto: UpdateAdvisoryDto) {
    return this.regionalService.updateAdvisory(req.user.id, id, dto);
  }

  @Get('reports/export')
  @ApiOperation({ summary: 'Export national report' })
  exportReport(@Req() req) {
    return this.regionalService.exportNationalReport(req.user);
  }
}
