import {
  Body,
  Controller,
  Get,
  Param,
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
import { WeatherService } from './weather.service';
import {
  CreateWeatherAlertDto,
  ListWeatherAlertsQueryDto,
} from './dto/weather.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Weather')
@ApiBearerAuth()
@Controller('weather')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Post('alerts')
  @Roles(UserRole.ADMIN, UserRole.GOVERNMENT)
  @ApiOperation({ summary: 'Create a weather alert and notify farmers' })
  createAlert(@Req() req, @Body() dto: CreateWeatherAlertDto) {
    return this.weatherService.createAlert(dto, req.user.id);
  }

  @Get('alerts')
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'List weather alerts' })
  listAlerts(@Query() query: ListWeatherAlertsQueryDto) {
    return this.weatherService.listAlerts(query);
  }

  @Get('alerts/:id')
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get a weather alert by id' })
  getAlert(@Param('id') id: string) {
    return this.weatherService.getAlert(id);
  }

  @Post('alerts/sync')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger OpenWeather sync' })
  sync() {
    return this.weatherService.syncOpenWeatherAlerts().then(() => ({
      message: 'OpenWeather sync completed',
    }));
  }
}
