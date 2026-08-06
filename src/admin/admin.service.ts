import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Farm } from '../entities/farm.entity';
import { Post } from '../entities/post.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { SupplierProfile } from '../entities/supplier-profile.entity';
import { NgoOrganization } from '../entities/ngo-organization.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { ApprovalStatus } from '../common/enums/approval-status.enum';
import { AuditService } from '../common/services/audit.service';
import { AuditAction } from '../entities/audit-log.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import {
  CreateUserDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  AssignRegionsDto,
  ApprovalDto,
  BroadcastDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(PredictionRun)
    private predictionRunRepository: Repository<PredictionRun>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(SupplierProfile)
    private supplierProfileRepository: Repository<SupplierProfile>,
    @InjectRepository(NgoOrganization)
    private ngoRepository: Repository<NgoOrganization>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async createUser(dto: CreateUserDto) {
    if (dto.role === UserRole.FARMER) {
      throw new BadRequestException('Farmers must self-register');
    }

    const duplicateConditions: Array<{ email?: string; phoneNumber?: string }> = [{ email: dto.email }];
    if (dto.phoneNumber) {
      duplicateConditions.push({ phoneNumber: dto.phoneNumber });
    }

    const existing = await this.userRepository.findOne({
      where: duplicateConditions,
    });
    if (existing) throw new ConflictException('User already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      role: dto.role,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      onboardingCompleted: true,
      onboardingStep: 3,
      assignedRegions: dto.assignedRegions || [],
    });

    await this.userRepository.save(user);

    if (dto.role === UserRole.NGO) {
      const org = this.ngoRepository.create({
        userId: user.id,
        user,
        organizationName: `${dto.firstName} ${dto.lastName} Organization`,
        approvalStatus: ApprovalStatus.APPROVED,
      });
      await this.ngoRepository.save(org);
    }

    return { message: 'User created successfully', user: { id: user.id, email: user.email, role: user.role } };
  }

  async getAllUsers(
    page = 1,
    limit = 20,
    role?: UserRole,
    status?: UserStatus,
    search?: string,
    includeDeleted = false,
  ) {
    const qb = this.userRepository.createQueryBuilder('user');

    if (!includeDeleted) {
      qb.where('user.deletedAt IS NULL');
    }

    if (role) qb.andWhere('user.role = :role', { role });
    if (status) qb.andWhere('user.status = :status', { status });
    if (search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.phoneNumber ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [users, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['farms'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserStatus(id: string, dto: UpdateUserStatusDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.status = dto.status as UserStatus;
    await this.userRepository.save(user);

    const action = dto.status === UserStatus.ACTIVE
      ? AuditAction.USER_REACTIVATED
      : AuditAction.USER_SUSPENDED;
    await this.auditService.log(action, id, user.email, { status: dto.status });

    return { message: 'User status updated', status: user.status };
  }

  async updateUserRole(id: string, dto: UpdateUserRoleDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException('Cannot demote admin through this endpoint without safeguards');
    }
    user.role = dto.role;
    await this.userRepository.save(user);
    return { message: 'User role updated', role: user.role };
  }

  async assignRegions(id: string, dto: AssignRegionsDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.NGO && user.role !== UserRole.GOVERNMENT) {
      throw new BadRequestException('Regions only for NGO/Government users');
    }
    user.assignedRegions = dto.regions;
    await this.userRepository.save(user);
    return { message: 'Regions assigned', assignedRegions: user.assignedRegions };
  }

  async softDeleteUser(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) throw new BadRequestException('Cannot delete admin users');

    user.deletedAt = new Date();
    user.status = UserStatus.BANNED;
    await this.userRepository.save(user);
    await this.auditService.log(AuditAction.USER_DELETED, id, user.email);
    return { message: 'User soft deleted' };
  }

  async restoreUser(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.deletedAt = null;
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);
    await this.auditService.log(AuditAction.USER_RESTORED, id, user.email);
    return { message: 'User restored' };
  }

  async approveSupplier(userId: string) {
    const profile = await this.supplierProfileRepository.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Supplier profile not found');

    profile.approvalStatus = ApprovalStatus.APPROVED;
    profile.rejectionReason = null;
    await this.supplierProfileRepository.save(profile);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.status = UserStatus.ACTIVE;
      await this.userRepository.save(user);
      await this.notificationService.create(
        userId,
        'Supplier Approved',
        'Your supplier account has been approved. You can now access the marketplace.',
        NotificationType.SYSTEM,
      );
    }

    await this.auditService.log(AuditAction.SUPPLIER_APPROVED, userId);
    return { message: 'Supplier approved' };
  }

  async rejectSupplier(userId: string, dto: ApprovalDto) {
    const profile = await this.supplierProfileRepository.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Supplier profile not found');

    profile.approvalStatus = ApprovalStatus.REJECTED;
    profile.rejectionReason = dto.reason ?? null;
    await this.supplierProfileRepository.save(profile);
    await this.auditService.log(AuditAction.SUPPLIER_REJECTED, userId, undefined, { reason: dto.reason });
    return { message: 'Supplier rejected' };
  }

  async approveNgo(userId: string) {
    const org = await this.ngoRepository.findOne({ where: { userId } });
    if (!org) throw new NotFoundException('NGO organization not found');

    org.approvalStatus = ApprovalStatus.APPROVED;
    await this.ngoRepository.save(org);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.status = UserStatus.ACTIVE;
      await this.userRepository.save(user);
    }

    await this.auditService.log(AuditAction.NGO_APPROVED, userId);
    return { message: 'NGO approved' };
  }

  async rejectNgo(userId: string, dto: ApprovalDto) {
    const org = await this.ngoRepository.findOne({ where: { userId } });
    if (!org) throw new NotFoundException('NGO organization not found');

    org.approvalStatus = ApprovalStatus.REJECTED;
    await this.ngoRepository.save(org);
    await this.auditService.log(AuditAction.NGO_REJECTED, userId, undefined, { reason: dto.reason });
    return { message: 'NGO rejected' };
  }

  async getPendingSuppliers() {
    return this.supplierProfileRepository.find({
      where: { approvalStatus: ApprovalStatus.PENDING },
      relations: ['user'],
    });
  }

  async getPendingNgos() {
    return this.ngoRepository.find({
      where: { approvalStatus: ApprovalStatus.PENDING },
      relations: ['user'],
    });
  }

  async broadcastAnnouncement(dto: BroadcastDto) {
    const users = await this.userRepository.find({
      where: { deletedAt: IsNull(), status: UserStatus.ACTIVE },
      select: ['id'],
    });

    for (const user of users) {
      await this.notificationService.create(
        user.id,
        dto.title,
        dto.message,
        NotificationType.SYSTEM,
      );
    }

    return { message: 'Announcement sent', recipientCount: users.length };
  }

  async getAuditLogs(page = 1, limit = 50, action?: AuditAction) {
    const where = action ? { action } : {};
    const [logs, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { logs, total, page, limit };
  }

  async getFarmStatistics() {
    const totalFarms = await this.farmRepository.count({ where: { isArchived: false } });
    const archivedFarms = await this.farmRepository.count({ where: { isArchived: true } });

    const farmsByProvince = await this.farmRepository
      .createQueryBuilder('farm')
      .select('farm.province', 'province')
      .addSelect('COUNT(*)', 'count')
      .where('farm.isArchived = false')
      .groupBy('farm.province')
      .getRawMany();

    const totalPredictions = await this.predictionRunRepository.count();
    const totalUsers = await this.userRepository.count({ where: { deletedAt: IsNull() } });
    const totalOrders = await this.orderRepository.count();
    const totalProducts = await this.productRepository.count({ where: { isActive: true } });

    const usersByRole = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .where('user.deletedAt IS NULL')
      .groupBy('user.role')
      .getRawMany();

    return {
      totalFarms,
      archivedFarms,
      totalUsers,
      totalPredictions,
      totalOrders,
      totalProducts,
      farmsByProvince,
      usersByRole,
    };
  }

  async getAllFarms(page = 1, limit = 20) {
    const [farms, total] = await this.farmRepository.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { farms, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
