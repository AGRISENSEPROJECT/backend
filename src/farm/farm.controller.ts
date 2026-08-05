import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  UseGuards,
  Req,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { FarmService } from './farm.service';
import { CreateFarmDto, UpdateFarmDto } from './dto/create-farm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiBearerAuth()
@ApiTags('Farm Management')
@Controller('farms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FARMER, UserRole.ADMIN)
export class FarmController {
  constructor(private farmService: FarmService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new farm with complete information' })
  @ApiBody({ type: CreateFarmDto })
  @ApiResponse({
    status: 201,
    description: 'Farm created successfully',
    schema: {
      example: {
        message: 'Farm created successfully',
        farm: {
          id: 'uuid-string',
          name: 'Green Valley Farm',
          size: 25.5,
          soilType: 'loamy',
          country: 'Rwanda',
          province: 'Kigali City',
          district: 'Gasabo',
          sector: 'Remera',
          cell: 'Rukiri I',
          village: 'Amahoro',
          ownerName: 'John Doe',
          ownerPhone: '+250788123456',
          ownerEmail: 'owner@example.com',
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createFarm(@Req() req: Request, @Body() createFarmDto: CreateFarmDto) {
    const user = this.getActor(req);
    return this.farmService.createFarm(user.id, createFarmDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all farms owned by the user' })
  @ApiResponse({
    status: 200,
    description: 'Farms retrieved successfully',
    schema: {
      example: {
        count: 2,
        farms: [
          {
            id: 'uuid-string-1',
            name: 'Green Valley Farm',
            size: 25.5,
            soilType: 'loamy',
            country: 'Rwanda',
            province: 'Kigali City',
            district: 'Gasabo',
            sector: 'Remera',
            cell: 'Rukiri I',
            village: 'Amahoro',
            createdAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'uuid-string-2',
            name: 'Sunset Farm',
            size: 15.0,
            soilType: 'clay',
            country: 'Rwanda',
            province: 'Eastern Province',
            district: 'Kicukiro',
            sector: 'Niboye',
            cell: 'Nyanza',
            village: 'Karama',
            createdAt: '2023-01-02T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllFarms(@Req() req: Request) {
    const user = this.getActor(req);
    return this.farmService.getAllFarms(user.id, user.role);
  }

  @Get(':farmId')
  @ApiOperation({ summary: 'Get a specific farm by ID' })
  @ApiParam({ name: 'farmId', description: 'Farm ID' })
  @ApiResponse({
    status: 200,
    description: 'Farm details retrieved successfully',
    schema: {
      example: {
        id: 'uuid-string',
        name: 'Green Valley Farm',
        size: 25.5,
        soilType: 'loamy',
        country: 'Rwanda',
        province: 'Kigali City',
        district: 'Gasabo',
        sector: 'Remera',
        cell: 'Rukiri I',
        village: 'Amahoro',
        ownerName: 'John Doe',
        ownerPhone: '+250788123456',
        ownerEmail: 'owner@example.com',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFarm(@Req() req: Request, @Param('farmId') farmId: string) {
    const user = this.getActor(req);
    return this.farmService.getFarm(user.id, farmId, user.role);
  }

  @Put(':farmId')
  @ApiOperation({ summary: 'Update farm information' })
  @ApiParam({ name: 'farmId', description: 'Farm ID' })
  @ApiBody({ type: UpdateFarmDto })
  @ApiResponse({
    status: 200,
    description: 'Farm updated successfully',
    schema: {
      example: {
        message: 'Farm updated successfully',
        farm: {
          id: 'uuid-string',
          name: 'Updated Farm Name',
          size: 30.0,
          soilType: 'loamy',
          country: 'Rwanda',
          province: 'Kigali City',
          district: 'Gasabo',
          sector: 'Remera',
          cell: 'Rukiri I',
          village: 'Amahoro',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateFarm(
    @Req() req: Request,
    @Param('farmId') farmId: string,
    @Body() updateFarmDto: UpdateFarmDto,
  ) {
    const user = this.getActor(req);
    return this.farmService.updateFarm(user.id, farmId, updateFarmDto, user.role);
  }

  @Delete(':farmId')
  @ApiOperation({ summary: 'Delete a farm' })
  @ApiParam({ name: 'farmId', description: 'Farm ID' })
  @ApiResponse({
    status: 200,
    description: 'Farm deleted successfully',
    schema: {
      example: {
        message: 'Farm deleted successfully',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteFarm(@Req() req: Request, @Param('farmId') farmId: string) {
    const user = this.getActor(req);
    return this.farmService.deleteFarm(user.id, farmId, user.role);
  }
}
