import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { PredictionService } from './prediction.service';

@ApiBearerAuth()
@ApiTags('Predictions')
@Controller('predictions')
@UseGuards(JwtAuthGuard)
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Post('run')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Run model prediction, store soil scan, prediction history, and recommendations',
  })
  @ApiBody({ type: CreatePredictionDto })
  @ApiResponse({ status: 201, description: 'Prediction run completed and stored' })
  @ApiResponse({ status: 400, description: 'Invalid request or missing image file' })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  @ApiResponse({ status: 502, description: 'Model API call failed' })
  async runPrediction(
    @Req() req: Request,
    @UploadedFile() image: Express.Multer.File | undefined,
    @Body() dto: CreatePredictionDto,
  ) {
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    if (!image) {
      throw new BadRequestException('image file is required');
    }

    return this.predictionService.runPrediction(userId, dto, image);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard data: latest soil composition, history, trends, and suggestions',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data fetched successfully' })
  async getDashboard(@Req() req: Request, @Query() query: DashboardQueryDto) {
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.predictionService.getDashboard(userId, query);
  }
}
