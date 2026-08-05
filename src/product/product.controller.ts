import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { ProductService } from './product.service';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Post()
  @Roles(UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Create a product (approved suppliers only)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  create(@Req() req: Request, @Body() dto: CreateProductDto) {
    return this.productService.createProduct(this.getActor(req), dto);
  }

  @Get('me')
  @Roles(UserRole.SUPPLIER)
  @ApiOperation({ summary: 'List my products' })
  getMine(@Req() req: Request, @Query() query: ListProductsQueryDto) {
    return this.productService.getMyProducts(this.getActor(req), query);
  }

  @Get()
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Browse active products from approved suppliers' })
  listCatalog(@Query() query: ListProductsQueryDto) {
    return this.productService.listCatalog(query);
  }

  @Get(':id')
  @Roles(
    UserRole.FARMER,
    UserRole.SUPPLIER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  getOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.productService.getProduct(id, this.getActor(req));
  }

  @Put(':id')
  @Roles(UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Update my product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.updateProduct(this.getActor(req), id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Deactivate my product (soft delete)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.productService.deactivateProduct(this.getActor(req), id);
  }
}
