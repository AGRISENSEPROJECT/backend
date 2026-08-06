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
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth, ApiParam, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { FarmService } from './farm.service';
import { FarmCropService } from './farm-crop.service';
import { CreateFarmDto, UpdateFarmDto } from './dto/create-farm.dto';
import { CreateFarmCropDto, UpdateFarmCropDto } from './dto/farm-crop.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiBearerAuth()
@ApiTags('Farm Management')
@Controller('farms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FARMER)
export class FarmController {
  constructor(
    private farmService: FarmService,
    private farmCropService: FarmCropService,
  ) {}

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
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.createFarm(userId, createFarmDto);
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
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.getAllFarms(userId);
  }

  @Get('archived/list')
  @ApiOperation({ summary: 'List archived farms' })
  async getArchivedFarms(@Req() req: Request) {
    return this.farmService.getAllFarms((req.user as any).id, true);
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
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.getFarm(userId, farmId);
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
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.updateFarm(userId, farmId, updateFarmDto);
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
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.deleteFarm(userId, farmId);
  }

  @Put(':farmId/archive')
  @ApiOperation({ summary: 'Archive farm (soft delete)' })
  async archiveFarm(@Req() req: Request, @Param('farmId') farmId: string) {
    return this.farmService.archiveFarm((req.user as any).id, farmId);
  }

  @Put(':farmId/restore')
  @ApiOperation({ summary: 'Restore archived farm' })
  async restoreFarm(@Req() req: Request, @Param('farmId') farmId: string) {
    return this.farmService.restoreFarm((req.user as any).id, farmId);
  }

  @Put(':farmId/active')
  @ApiOperation({ summary: 'Set active farm' })
  async setActiveFarm(@Req() req: Request, @Param('farmId') farmId: string) {
    return this.farmService.setActiveFarm((req.user as any).id, farmId);
  }

  @Post(':farmId/image')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload farm image' })
  async uploadFarmImage(
    @Req() req: Request,
    @Param('farmId') farmId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.farmService.uploadFarmImage((req.user as any).id, farmId, file);
  }

  @Post(':farmId/crops')
  @ApiOperation({ summary: 'Record crop to be planted' })
  recordCrop(@Req() req: Request, @Param('farmId') farmId: string, @Body() dto: CreateFarmCropDto) {
    return this.farmCropService.recordCrop((req.user as any).id, farmId, dto);
  }

  @Get(':farmId/crops')
  @ApiOperation({ summary: 'List crops for a farm' })
  getFarmCrops(@Req() req: Request, @Param('farmId') farmId: string) {
    return this.farmCropService.getFarmCrops((req.user as any).id, farmId);
  }

  @Put(':farmId/crops/:cropId')
  @ApiOperation({ summary: 'Update crop record (status, harvest dates)' })
  updateCrop(
    @Req() req: Request,
    @Param('farmId') farmId: string,
    @Param('cropId') cropId: string,
    @Body() dto: UpdateFarmCropDto,
  ) {
    return this.farmCropService.updateCrop((req.user as any).id, farmId, cropId, dto);
  }

  @Delete(':farmId/crops/:cropId')
  deleteCrop(@Req() req: Request, @Param('farmId') farmId: string, @Param('cropId') cropId: string) {
    return this.farmCropService.deleteCrop((req.user as any).id, farmId, cropId);
  }
}
