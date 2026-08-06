import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Product } from '../entities/product.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { User, AuthProvider } from '../entities/user.entity';
import { SupplierProfile } from '../entities/supplier-profile.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { ApprovalStatus } from '../common/enums/approval-status.enum';
import { CloudinaryService } from '../auth/cloudinary.service';
import { CreateProductDto, UpdateProductDto, CreateOrderDto, UpdateOrderStatusDto } from './dto/supplier.dto';
import { SupplierRegisterDto, UpdateSupplierProfileDto } from './dto/supplier-register.dto';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SupplierProfile)
    private supplierProfileRepository: Repository<SupplierProfile>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async registerSupplier(dto: SupplierRegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('User already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.contactPhone,
      role: UserRole.SUPPLIER,
      status: UserStatus.PENDING,
      provider: AuthProvider.LOCAL,
      onboardingCompleted: true,
      isEmailVerified: false,
    });
    await this.userRepository.save(user);

    const profile = this.supplierProfileRepository.create({
      userId: user.id,
      user,
      businessName: dto.businessName,
      businessLocation: dto.businessLocation,
      businessCategory: dto.businessCategory,
      businessDescription: dto.businessDescription,
      contactPhone: dto.contactPhone,
      contactEmail: dto.email,
      approvalStatus: ApprovalStatus.PENDING,
      serviceRegions: dto.serviceRegions || [],
    });
    await this.supplierProfileRepository.save(profile);

    return {
      message: 'Supplier registration submitted. Awaiting admin approval.',
      userId: user.id,
      approvalStatus: ApprovalStatus.PENDING,
    };
  }

  private async ensureApprovedSupplier(supplierId: string) {
    const profile = await this.supplierProfileRepository.findOne({ where: { userId: supplierId } });
    if (!profile || profile.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Supplier account not approved for marketplace operations');
    }
    return profile;
  }

  async updateBusinessProfile(supplierId: string, dto: UpdateSupplierProfileDto) {
    const profile = await this.supplierProfileRepository.findOne({ where: { userId: supplierId } });
    if (!profile) throw new NotFoundException('Supplier profile not found');
    Object.assign(profile, dto);
    await this.supplierProfileRepository.save(profile);
    return { message: 'Profile updated', profile };
  }

  async uploadBusinessLogo(supplierId: string, file: Express.Multer.File) {
    const profile = await this.supplierProfileRepository.findOne({ where: { userId: supplierId } });
    if (!profile) throw new NotFoundException('Supplier profile not found');
    if (profile.logoUrl) await this.cloudinaryService.deleteImage(profile.logoUrl);
    profile.logoUrl = await this.cloudinaryService.uploadImage(file);
    await this.supplierProfileRepository.save(profile);
    return { message: 'Logo uploaded', logoUrl: profile.logoUrl };
  }

  async getBusinessProfile(supplierId: string) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { userId: supplierId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Supplier profile not found');
    return profile;
  }

  async createProduct(supplierId: string, dto: CreateProductDto) {
    await this.ensureApprovedSupplier(supplierId);
    const product = this.productRepository.create({ ...dto, supplierId });
    await this.productRepository.save(product);
    return { message: 'Product created', product };
  }

  async getMyProducts(supplierId: string) {
    return this.productRepository.find({
      where: { supplierId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateProduct(supplierId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.productRepository.findOne({
      where: { id: productId, supplierId },
    });
    if (!product) throw new NotFoundException('Product not found');
    Object.assign(product, dto);
    await this.productRepository.save(product);
    return { message: 'Product updated', product };
  }

  async uploadBusinessLicense(supplierId: string, file: Express.Multer.File) {
    const profile = await this.supplierProfileRepository.findOne({ where: { userId: supplierId } });
    if (!profile) throw new NotFoundException('Supplier profile not found');
    if (profile.businessLicenseUrl) await this.cloudinaryService.deleteImage(profile.businessLicenseUrl);
    profile.businessLicenseUrl = await this.cloudinaryService.uploadImage(file);
    await this.supplierProfileRepository.save(profile);
    return { message: 'Business license uploaded', businessLicenseUrl: profile.businessLicenseUrl };
  }

  async uploadProductImage(supplierId: string, productId: string, file: Express.Multer.File) {
    await this.ensureApprovedSupplier(supplierId);
    const product = await this.productRepository.findOne({ where: { id: productId, supplierId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.imageUrl) await this.cloudinaryService.deleteImage(product.imageUrl);
    product.imageUrl = await this.cloudinaryService.uploadImage(file);
    await this.productRepository.save(product);
    return { message: 'Product image uploaded', imageUrl: product.imageUrl };
  }

  async archiveProduct(supplierId: string, productId: string) {
    const product = await this.productRepository.findOne({ where: { id: productId, supplierId } });
    if (!product) throw new NotFoundException('Product not found');
    product.isArchived = true;
    product.isActive = false;
    await this.productRepository.save(product);
    return { message: 'Product archived' };
  }

  async deleteProduct(supplierId: string, productId: string) {
    return this.archiveProduct(supplierId, productId);
  }

  async getCatalog(page = 1, limit = 20, category?: string) {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .innerJoin('product.supplier', 'supplier')
      .innerJoin(SupplierProfile, 'profile', 'profile.userId = supplier.id')
      .where('product.isActive = true')
      .andWhere('product.isArchived = false')
      .andWhere('profile.approvalStatus = :status', { status: ApprovalStatus.APPROVED });

    if (category) qb.andWhere('product.category = :category', { category });

    const [products, total] = await qb
      .orderBy('product.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { products, total, page, limit };
  }

  async getProductById(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId, isActive: true },
      relations: ['supplier'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createOrder(buyerId: string, dto: CreateOrderDto) {
    const product = await this.productRepository.findOne({
      where: { id: dto.productId, isActive: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.stock < dto.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const order = this.orderRepository.create({
      buyerId,
      productId: dto.productId,
      quantity: dto.quantity,
      totalPrice: product.price * dto.quantity,
      notes: dto.notes,
      status: OrderStatus.PENDING,
    });

    product.stock -= dto.quantity;
    await this.productRepository.save(product);
    await this.orderRepository.save(order);
    return { message: 'Order placed', order };
  }

  async getMyOrders(userId: string, role: UserRole) {
    if (role === UserRole.SUPPLIER) {
      return this.orderRepository
        .createQueryBuilder('order')
        .innerJoinAndSelect('order.product', 'product')
        .innerJoinAndSelect('order.buyer', 'buyer')
        .where('product.supplierId = :supplierId', { supplierId: userId })
        .orderBy('order.createdAt', 'DESC')
        .getMany();
    }
    return this.orderRepository.find({
      where: { buyerId: userId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateOrderStatus(supplierId: string, orderId: string, dto: UpdateOrderStatusDto) {
    await this.ensureApprovedSupplier(supplierId);
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['product'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.product.supplierId !== supplierId) {
      throw new ForbiddenException('You can only update your own product orders');
    }
    order.status = dto.status as OrderStatus;
    await this.orderRepository.save(order);
    return { message: 'Order status updated', order };
  }

  async getSalesReport(supplierId: string) {
    await this.ensureApprovedSupplier(supplierId);
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .innerJoin('order.product', 'product')
      .where('product.supplierId = :supplierId', { supplierId })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .getMany();

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const totalOrders = orders.length;
    const delivered = orders.filter((o) => o.status === OrderStatus.DELIVERED).length;

    return { totalRevenue, totalOrders, deliveredOrders: delivered, orders };
  }

  async getSupplierProfile(supplierId: string) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { userId: supplierId },
    });
    if (!profile) throw new NotFoundException('Supplier not found');
    const productCount = await this.productRepository.count({
      where: { supplierId, isActive: true, isArchived: false },
    });
    return {
      id: profile.userId,
      businessName: profile.businessName,
      businessDescription: profile.businessDescription,
      businessLocation: profile.businessLocation,
      businessCategory: profile.businessCategory,
      logoUrl: profile.logoUrl,
      rating: profile.rating,
      ratingCount: profile.ratingCount,
      deliveryCapability: profile.deliveryCapability,
      verificationStatus: profile.verificationStatus,
      productCount,
    };
  }
}
