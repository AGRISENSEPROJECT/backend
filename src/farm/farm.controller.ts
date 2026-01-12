import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { FarmService } from './farm.service';
import {
  CreateFarmDto,
  UpdateFarmLocationDto,
  UpdateFarmOwnerDto,
} from './dto/create-farm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@Controller('farm')
@UseGuards(JwtAuthGuard)
export class FarmController {
  constructor(private farmService: FarmService) { }

  @Post()
  async createFarm(@Req() req: Request, @Body() createFarmDto: CreateFarmDto) {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.createFarm(userId, createFarmDto);
  }

  @Put('location')
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
  async getFarm(@Req() req: Request) {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.getFarm(userId);
  }

  @Get('status')
  async getRegistrationStatus(@Req() req: Request) {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.farmService.getFarmRegistrationStatus(userId);
  }
}