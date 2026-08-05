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
import { IoTService } from './iot.service';
import {
  IngestReadingDto,
  ListReadingsQueryDto,
  RegisterSensorDto,
  UpdateSensorStatusDto,
} from './dto/iot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('IoT')
@ApiBearerAuth()
@Controller('iot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IoTController {
  constructor(private readonly iotService: IoTService) {}

  @Post('sensors')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Register an IoT sensor on a farm' })
  register(@Req() req, @Body() dto: RegisterSensorDto) {
    return this.iotService.registerSensor(req.user.id, req.user.role, dto);
  }

  @Get('sensors')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List IoT sensors' })
  list(@Req() req, @Query('farmId') farmId?: string) {
    return this.iotService.listSensors(req.user.id, req.user.role, farmId);
  }

  @Patch('sensors/:id/status')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update sensor status' })
  updateStatus(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateSensorStatusDto,
  ) {
    return this.iotService.updateStatus(req.user.id, req.user.role, id, dto);
  }

  @Post('readings')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Ingest a sensor reading' })
  ingest(@Req() req, @Body() dto: IngestReadingDto) {
    return this.iotService.ingestReading(req.user.id, req.user.role, dto);
  }

  @Get('sensors/:id/readings')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List recent readings for a sensor' })
  listReadings(
    @Req() req,
    @Param('id') id: string,
    @Query() query: ListReadingsQueryDto,
  ) {
    return this.iotService.listReadings(
      req.user.id,
      req.user.role,
      id,
      query.limit ?? 50,
    );
  }
}
