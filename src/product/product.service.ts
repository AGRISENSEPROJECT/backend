import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import {
  SupplierProfile,
  SupplierVerificationStatus,
} from '../entities/supplier-profile.entity';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(SupplierProfile)
    private readonly supplierProfileRepository: Repository<SupplierProfile>,
  ) {}

  private toProductResponse(product: Product) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: Number(product.price),
      stock: product.stock,
      unit: product.unit,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      supplierProfileId: product.supplierProfileId,
      supplier: product.supplierProfile
        ? {
            id: product.supplierProfile.id,
            businessName: product.supplierProfile.businessName,
            district: product.supplierProfile.district,
            province: product.supplierProfile.province,
          }
        : undefined,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private async requireApprovedSupplierProfile(user: User) {
    if (user.role !== UserRole.SUPPLIER) {
      throw new ForbiddenException('Only suppliers can manage products');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Supplier account must be active before managing products',
      );
    }

    const profile = await this.supplierProfileRepository.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new BadRequestException(
        'Create a supplier profile before adding products',
      );
    }

    if (profile.verificationStatus !== SupplierVerificationStatus.APPROVED) {
      throw new ForbiddenException(
        'Supplier profile must be approved before selling products',
      );
    }

    return profile;
  }

  async createProduct(user: User, dto: CreateProductDto) {
    const profile = await this.requireApprovedSupplierProfile(user);

    const product = this.productRepository.create({
      supplierProfileId: profile.id,
      name: dto.name,
      description: dto.description ?? null,
      category: dto.category ?? null,
      price: dto.price,
      stock: dto.stock,
      unit: dto.unit ?? 'unit',
      imageUrl: dto.imageUrl ?? null,
      isActive: dto.isActive ?? true,
    });

    await this.productRepository.save(product);

    const saved = await this.productRepository.findOne({
      where: { id: product.id },
      relations: ['supplierProfile'],
    });

    return {
      message: 'Product created successfully',
      product: this.toProductResponse(saved!),
    };
  }

  async updateProduct(user: User, productId: string, dto: UpdateProductDto) {
    const profile = await this.requireApprovedSupplierProfile(user);

    const product = await this.productRepository.findOne({
      where: { id: productId, supplierProfileId: profile.id },
      relations: ['supplierProfile'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    Object.assign(product, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });

    await this.productRepository.save(product);

    return {
      message: 'Product updated successfully',
      product: this.toProductResponse(product),
    };
  }

  async deactivateProduct(user: User, productId: string) {
    const profile = await this.requireApprovedSupplierProfile(user);

    const product = await this.productRepository.findOne({
      where: { id: productId, supplierProfileId: profile.id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.isActive = false;
    await this.productRepository.save(product);

    return { message: 'Product deactivated successfully' };
  }

  async getMyProducts(user: User, query: ListProductsQueryDto) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Supplier profile not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.productRepository.findAndCount({
      where: {
        supplierProfileId: profile.id,
        ...(query.category ? { category: query.category } : {}),
        ...(query.search ? { name: ILike(`%${query.search}%`) } : {}),
      },
      relations: ['supplierProfile'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) => this.toProductResponse(item)),
      total,
      page,
      limit,
    };
  }

  async listCatalog(query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.supplierProfile', 'supplier')
      .leftJoin('supplier.user', 'user')
      .where('product.isActive = :isActive', { isActive: true })
      .andWhere('product.stock > 0')
      .andWhere('supplier.verificationStatus = :verificationStatus', {
        verificationStatus: SupplierVerificationStatus.APPROVED,
      })
      .andWhere('user.status = :userStatus', { userStatus: UserStatus.ACTIVE });

    if (query.supplierProfileId) {
      qb.andWhere('product.supplierProfileId = :supplierProfileId', {
        supplierProfileId: query.supplierProfileId,
      });
    }

    if (query.category) {
      qb.andWhere('product.category = :category', { category: query.category });
    }

    if (query.search) {
      qb.andWhere('product.name ILIKE :search', { search: `%${query.search}%` });
    }

    qb.orderBy('product.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.toProductResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getProduct(productId: string, actor?: User) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['supplierProfile', 'supplierProfile.user'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isOwner =
      actor?.role === UserRole.SUPPLIER &&
      product.supplierProfile?.userId === actor.id;
    const isAdmin = actor?.role === UserRole.ADMIN;
    const isPublic =
      product.isActive &&
      product.supplierProfile?.verificationStatus ===
        SupplierVerificationStatus.APPROVED &&
      product.supplierProfile?.user?.status === UserStatus.ACTIVE;

    if (!isPublic && !isOwner && !isAdmin) {
      throw new NotFoundException('Product not found');
    }

    return this.toProductResponse(product);
  }
}
