import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GOVERNMENT, UserRole.ADMIN, UserRole.NGO)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Roles(UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Platform overview stats (aggregated, no private farmer PII)',
  })
  getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('regions')
  @Roles(UserRole.GOVERNMENT, UserRole.ADMIN, UserRole.NGO)
  @ApiOperation({ summary: 'Farm counts by province/district' })
  @ApiQuery({ name: 'province', required: false })
  @ApiQuery({ name: 'district', required: false })
  getRegions(
    @Query('province') province?: string,
    @Query('district') district?: string,
  ) {
    return this.analyticsService.getRegionalFarmStats(province, district);
  }

  @Get('predictions')
  @Roles(UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Aggregated prediction outcomes by province' })
  @ApiQuery({ name: 'province', required: false })
  getPredictions(@Query('province') province?: string) {
    return this.analyticsService.getPredictionStats(province);
  }

  @Get('programs')
  @Roles(UserRole.GOVERNMENT, UserRole.ADMIN, UserRole.NGO)
  @ApiOperation({ summary: 'Program statistics and assigned farmer counts' })
  getPrograms() {
    return this.analyticsService.getProgramStats();
  }
}
