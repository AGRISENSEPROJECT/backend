import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { YieldService } from './yield.service';
import {
  CreateYieldForecastDto,
  UpdateYieldForecastStatusDto,
} from './dto/yield.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Yield')
@ApiBearerAuth()
@Controller('yield')
@UseGuards(JwtAuthGuard, RolesGuard)
export class YieldController {
  constructor(private readonly yieldService: YieldService) {}

  @Post('forecasts')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a yield forecast for a farm' })
  create(@Req() req, @Body() dto: CreateYieldForecastDto) {
    return this.yieldService.createForecast(req.user.id, req.user.role, dto);
  }

  @Get('forecasts')
  @Roles(
    UserRole.FARMER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'List yield forecasts' })
  list(@Req() req, @Query('farmId') farmId?: string) {
    return this.yieldService.listForecasts(req.user.id, req.user.role, farmId);
  }

  @Get('forecasts/:id')
  @Roles(
    UserRole.FARMER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get a yield forecast' })
  get(@Req() req, @Param('id') id: string) {
    return this.yieldService.getForecast(req.user.id, req.user.role, id);
  }

  @Patch('forecasts/:id/status')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Publish or draft a yield forecast' })
  updateStatus(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateYieldForecastStatusDto,
  ) {
    return this.yieldService.updateStatus(req.user.id, req.user.role, id, dto);
  }
}
