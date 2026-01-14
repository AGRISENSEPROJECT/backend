import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { FarmService } from './farm.service';
import {
  CreateFarmDto,
  UpdateFarmLocationDto,
  UpdateFarmOwnerDto,
} from './dto/create-farm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@ApiTags('Farm Management')
@Controller('farm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FarmController {
  constructor(private farmService: FarmService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new farm' })
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
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'User already has a farm' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createFarm(@Req() req: Request, @Body() createFarmDto: CreateFarmDto) {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.createFarm(userId, createFarmDto);
  }

  @Put('location')
  @ApiOperation({ summary: 'Update farm location information' })
  @ApiBody({ type: UpdateFarmLocationDto })
  @ApiResponse({
    status: 200,
    description: 'Farm location updated successfully',
    schema: {
      example: {
        message: 'Farm location updated successfully',
        farm: {
          id: 'uuid-string',
          country: 'Kenya',
          district: 'Nakuru',
          latitude: -0.3031,
          longitude: 36.0800,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateLocation(
    @Req() req: Request,
    @Body() updateLocationDto: UpdateFarmLocationDto,
  ) {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.updateFarmLocation(userId, updateLocationDto);
  }

  @Put('owner')
  @ApiOperation({ summary: 'Update farm owner information' })
  @ApiBody({ type: UpdateFarmOwnerDto })
  @ApiResponse({
    status: 200,
    description: 'Farm owner information updated successfully',
    schema: {
      example: {
        message: 'Farm owner information updated successfully',
        farm: {
          id: 'uuid-string',
          ownerName: 'John Doe',
          ownerPhone: '+254712345678',
          ownerEmail: 'owner@example.com',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateOwner(
    @Req() req: Request,
    @Body() updateOwnerDto: UpdateFarmOwnerDto,
  ) {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.updateFarmOwner(userId, updateOwnerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get farm details' })
  @ApiResponse({
    status: 200,
    description: 'Farm details retrieved successfully',
    schema: {
      example: {
        id: 'uuid-string',
        name: 'Green Valley Farm',
        size: 25.5,
        soilType: 'loamy',
        country: 'Kenya',
        district: 'Nakuru',
        latitude: -0.3031,
        longitude: 36.0800,
        ownerName: 'John Doe',
        ownerPhone: '+254712345678',
        ownerEmail: 'owner@example.com',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFarm(@Req() req: Request) {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.getFarm(userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get farm registration status' })
  @ApiResponse({
    status: 200,
    description: 'Farm registration status retrieved successfully',
    schema: {
      example: {
        hasFarm: true,
        hasLocation: true,
        hasOwnerInfo: true,
        isComplete: true,
        farm: {
          id: 'uuid-string',
          name: 'Green Valley Farm',
          size: 25.5,
          soilType: 'loamy',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRegistrationStatus(@Req() req: Request) {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.getFarmRegistrationStatus(userId);
  }
}