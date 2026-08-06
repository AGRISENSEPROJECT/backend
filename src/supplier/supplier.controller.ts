import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupplierService } from './supplier.service';
import { SupplierIntelligenceService } from './supplier-intelligence.service';
import { MarketplaceMatchingService } from './marketplace-matching.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  FarmDiscoveryQueryDto,
} from './dto/supplier.dto';
import { SupplierRegisterDto, UpdateSupplierProfileDto } from './dto/supplier-register.dto';

@ApiTags('Supplier')
@Controller('supplier')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post('register')
  @ApiOperation({ summary: 'Supplier self-registration (pending approval)' })
  register(@Body() dto: SupplierRegisterDto) {
    return this.supplierService.registerSupplier(dto);
  }

  @Get('profile/:id')
  @ApiOperation({ summary: 'Public supplier business profile (no personal data)' })
  getSupplierProfile(@Param('id') id: string) {
    return this.supplierService.getSupplierProfile(id);
  }
}

@ApiTags('Supplier')
@ApiBearerAuth()
@Controller('supplier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPPLIER)
export class SupplierAuthController {
  constructor(
    private readonly supplierService: SupplierService,
    private readonly intelligenceService: SupplierIntelligenceService,
  ) {}

  @Get('profile')
  getMyProfile(@Req() req) {
    return this.supplierService.getBusinessProfile(req.user.id);
  }

  @Put('profile')
  updateProfile(@Req() req, @Body() dto: UpdateSupplierProfileDto) {
    return this.supplierService.updateBusinessProfile(req.user.id, dto);
  }

  @Post('profile/logo')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  uploadLogo(@Req() req, @UploadedFile() file: Express.Multer.File) {
    return this.supplierService.uploadBusinessLogo(req.user.id, file);
  }

  @Post('profile/license')
  @UseInterceptors(FileInterceptor('document'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload business license' })
  uploadLicense(@Req() req, @UploadedFile() file: Express.Multer.File) {
    return this.supplierService.uploadBusinessLicense(req.user.id, file);
  }

  @Post('products')
  createProduct(@Req() req, @Body() dto: CreateProductDto) {
    return this.supplierService.createProduct(req.user.id, dto);
  }

  @Get('products')
  getMyProducts(@Req() req) {
    return this.supplierService.getMyProducts(req.user.id);
  }

  @Put('products/:id')
  updateProduct(@Req() req, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.supplierService.updateProduct(req.user.id, id, dto);
  }

  @Post('products/:id/image')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  uploadProductImage(@Req() req, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.supplierService.uploadProductImage(req.user.id, id, file);
  }

  @Put('products/:id/archive')
  @ApiOperation({ summary: 'Archive unavailable product' })
  archiveProduct(@Req() req, @Param('id') id: string) {
    return this.supplierService.archiveProduct(req.user.id, id);
  }

  @Delete('products/:id')
  deleteProduct(@Req() req, @Param('id') id: string) {
    return this.supplierService.deleteProduct(req.user.id, id);
  }

  @Get('orders')
  getSupplierOrders(@Req() req) {
    return this.supplierService.getMyOrders(req.user.id, UserRole.SUPPLIER);
  }

  @Put('orders/:id/status')
  updateOrderStatus(@Req() req, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.supplierService.updateOrderStatus(req.user.id, id, dto);
  }

  @Get('sales-report')
  getSalesReport(@Req() req) {
    return this.supplierService.getSalesReport(req.user.id);
  }

  @Get('intelligence/regional')
  @ApiOperation({ summary: 'Regional agricultural intelligence (aggregated, anonymized)' })
  getRegionalIntelligence(@Req() req) {
    return this.intelligenceService.getRegionalIntelligence(req.user.id);
  }

  @Get('intelligence/farms')
  @ApiOperation({ summary: 'Discover farms in service regions (anonymized)' })
  discoverFarms(@Req() req, @Query() query: FarmDiscoveryQueryDto, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.intelligenceService.discoverFarms(req.user.id, { ...query, page: page || 1, limit: limit || 20 });
  }

  @Get('intelligence/ai-demand')
  @ApiOperation({ summary: 'Anonymized AI recommendation demand signals' })
  getAiDemand(@Req() req) {
    return this.intelligenceService.getAiDemandSignals(req.user.id);
  }

  @Get('intelligence/harvest')
  @ApiOperation({ summary: 'Harvest visibility in service regions' })
  getHarvestVisibility(@Req() req) {
    return this.intelligenceService.getHarvestVisibility(req.user.id);
  }
}

@ApiTags('Marketplace')
@ApiBearerAuth()
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(
    private readonly supplierService: SupplierService,
    private readonly matchingService: MarketplaceMatchingService,
  ) {}

  @Get('products')
  getCatalog(@Query('page') page?: number, @Query('limit') limit?: number, @Query('category') category?: string) {
    return this.supplierService.getCatalog(page || 1, limit || 20, category);
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.supplierService.getProductById(id);
  }

  @Get('matched-products')
  @Roles(UserRole.FARMER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'AI-matched products from verified suppliers (farmer chooses independently)' })
  getMatchedProducts(
    @Req() req,
    @Query('farmId') farmId: string,
    @Query('recommendationIds') recommendationIds?: string,
  ) {
    const ids = recommendationIds ? recommendationIds.split(',') : undefined;
    return this.matchingService.matchProductsForFarmer(req.user.id, farmId, ids);
  }

  @Post('orders')
  @Roles(UserRole.FARMER)
  @UseGuards(RolesGuard)
  createOrder(@Req() req, @Body() dto: CreateOrderDto) {
    return this.supplierService.createOrder(req.user.id, dto);
  }

  @Get('orders')
  @Roles(UserRole.FARMER)
  @UseGuards(RolesGuard)
  getMyOrders(@Req() req) {
    return this.supplierService.getMyOrders(req.user.id, UserRole.FARMER);
  }
}
