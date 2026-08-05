import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  PredictionHistoryQueryDto,
  RecommendationQueryDto,
} from './dto/history-query.dto';
import { PredictionService } from './prediction.service';

@ApiBearerAuth()
@ApiTags('Predictions')
@Controller('predictions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FARMER, UserRole.ADMIN)
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

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
    const user = this.getActor(req);
    if (!image) {
      throw new BadRequestException('image file is required');
    }

    return this.predictionService.runPrediction(user.id, dto, image, user.role);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard data: latest soil composition, history, trends, and suggestions',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data fetched successfully' })
  async getDashboard(@Req() req: Request, @Query() query: DashboardQueryDto) {
    const user = this.getActor(req);
    return this.predictionService.getDashboard(user.id, query, user.role);
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'List past recommendations (filterable by farm and type, paginated)',
  })
  @ApiResponse({ status: 200, description: 'Recommendations fetched successfully' })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  async getRecommendations(
    @Req() req: Request,
    @Query() query: RecommendationQueryDto,
  ) {
    const user = this.getActor(req);
    return this.predictionService.getRecommendationHistory(
      user.id,
      query,
      user.role,
    );
  }

  @Get('runs')
  @ApiOperation({
    summary: 'List past prediction runs with their recommendations (paginated)',
  })
  @ApiResponse({ status: 200, description: 'Prediction runs fetched successfully' })
  @ApiResponse({ status: 404, description: 'Farm not found' })
  async getRuns(@Req() req: Request, @Query() query: PredictionHistoryQueryDto) {
    const user = this.getActor(req);
    return this.predictionService.getPredictionHistory(user.id, query, user.role);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Get a single prediction run with its recommendations' })
  @ApiResponse({ status: 200, description: 'Prediction run fetched successfully' })
  @ApiResponse({ status: 404, description: 'Prediction run not found' })
  async getRun(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const user = this.getActor(req);
    return this.predictionService.getPredictionRun(user.id, id, user.role);
  }
}
