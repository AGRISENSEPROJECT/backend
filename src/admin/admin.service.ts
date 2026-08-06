import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
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
import { WaitlistService } from '../waitlist/waitlist.service';
import {
  CreateUserDto,
  CreateSupplierAccountDto,
  CreateNgoAccountDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  AssignRegionsDto,
  ApprovalDto,
  BroadcastDto,
  AdminResetPasswordDto,
  ModeratePostDto,
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
    private waitlistService: WaitlistService,
  ) {}

  private assertNotTargetingAdmin(actorId: string | undefined, target: User, action: string) {
    if (target.role !== UserRole.ADMIN) {
      return;
    }
    if (actorId && target.id === actorId) {
      throw new ForbiddenException(`Admins cannot ${action} themselves`);
    }
    throw new ForbiddenException(`Admins cannot ${action} other admin accounts`);
  }

  async createUser(dto: CreateUserDto, actorId?: string) {
    if (dto.role === UserRole.FARMER) {
      throw new BadRequestException('Farmers must self-register');
    }
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin accounts cannot be created through this endpoint');
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
      email: dto.email.toLowerCase().trim(),
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
        contactEmail: user.email,
        contactPhone: dto.phoneNumber,
      });
      await this.ngoRepository.save(org);
    }

    if (dto.role === UserRole.SUPPLIER) {
      const profile = this.supplierProfileRepository.create({
        userId: user.id,
        user,
        businessName: `${dto.firstName} ${dto.lastName} Supplies`,
        businessLocation: 'Rwanda',
        businessCategory: 'OTHER',
        contactEmail: user.email,
        contactPhone: dto.phoneNumber,
        approvalStatus: ApprovalStatus.APPROVED,
        verificationStatus: ApprovalStatus.APPROVED,
        serviceRegions: dto.assignedRegions || [],
      });
      await this.supplierProfileRepository.save(profile);
    }

    await this.auditService.log(AuditAction.REGISTER, actorId, user.email, {
      createdRole: user.role,
      via: 'admin.createUser',
    });

    return {
      message: 'User created successfully',
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    };
  }

  async createSupplierAccount(dto: CreateSupplierAccountDto, actorId?: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('User with this email already exists');

    const autoApprove = dto.autoApprove !== false;
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      role: UserRole.SUPPLIER,
      status: autoApprove ? UserStatus.ACTIVE : UserStatus.PENDING,
      isEmailVerified: true,
      onboardingCompleted: true,
      onboardingStep: 3,
    });
    await this.userRepository.save(user);

    const profile = this.supplierProfileRepository.create({
      userId: user.id,
      user,
      businessName: dto.businessName,
      businessLocation: dto.businessLocation,
      businessCategory: dto.businessCategory,
      businessDescription: dto.businessDescription ?? null,
      contactPhone: dto.phoneNumber ?? null,
      contactEmail: email,
      serviceRegions: dto.serviceRegions || [],
      approvalStatus: autoApprove ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
      verificationStatus: autoApprove ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
    });
    await this.supplierProfileRepository.save(profile);

    await this.notificationService.create(
      user.id,
      'Supplier Account Created',
      autoApprove
        ? 'An administrator created and approved your supplier account. You can now sign in.'
        : 'An administrator created your supplier account. It is pending approval.',
      NotificationType.SYSTEM,
    );

    await this.auditService.log(AuditAction.SUPPLIER_APPROVED, actorId, email, {
      supplierId: user.id,
      autoApprove,
      via: 'admin.createSupplierAccount',
    });

    return {
      message: autoApprove
        ? 'Supplier account created and approved'
        : 'Supplier account created and pending approval',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      profile: {
        id: profile.id,
        businessName: profile.businessName,
        approvalStatus: profile.approvalStatus,
      },
    };
  }

  async createNgoAccount(dto: CreateNgoAccountDto, actorId?: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('User with this email already exists');

    const autoApprove = dto.autoApprove !== false;
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      role: UserRole.NGO,
      status: autoApprove ? UserStatus.ACTIVE : UserStatus.PENDING,
      isEmailVerified: true,
      onboardingCompleted: true,
      onboardingStep: 3,
      assignedRegions: dto.assignedRegions || [],
    });
    await this.userRepository.save(user);

    const org = this.ngoRepository.create({
      userId: user.id,
      user,
      organizationName: dto.organizationName,
      description: dto.description ?? undefined,
      registrationNumber: dto.registrationNumber ?? undefined,
      contactEmail: email,
      contactPhone: dto.phoneNumber ?? undefined,
      website: dto.website ?? undefined,
      focusAreas: dto.focusAreas || [],
      approvalStatus: autoApprove ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
    });
    await this.ngoRepository.save(org);

    await this.notificationService.create(
      user.id,
      'NGO Account Created',
      autoApprove
        ? 'An administrator created and approved your NGO account. You can now sign in.'
        : 'An administrator created your NGO account. It is pending approval.',
      NotificationType.SYSTEM,
    );

    await this.auditService.log(AuditAction.NGO_APPROVED, actorId, email, {
      ngoUserId: user.id,
      autoApprove,
      via: 'admin.createNgoAccount',
    });

    return {
      message: autoApprove
        ? 'NGO account created and approved'
        : 'NGO account created and pending approval',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        assignedRegions: user.assignedRegions,
      },
      organization: {
        id: org.id,
        organizationName: org.organizationName,
        approvalStatus: org.approvalStatus,
      },
    };
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

  async updateUserStatus(id: string, dto: UpdateUserStatusDto, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.status === UserStatus.SUSPENDED || dto.status === UserStatus.BANNED) {
      this.assertNotTargetingAdmin(actorId, user, 'suspend or ban');
    }

    user.status = dto.status as UserStatus;
    await this.userRepository.save(user);

    const action =
      dto.status === UserStatus.ACTIVE
        ? AuditAction.USER_REACTIVATED
        : AuditAction.USER_SUSPENDED;
    await this.auditService.log(action, actorId || id, user.email, { status: dto.status, targetUserId: id });

    return { message: 'User status updated', status: user.status };
  }

  async suspendUser(id: string, actorId: string) {
    return this.updateUserStatus(id, { status: UserStatus.SUSPENDED }, actorId);
  }

  async banUser(id: string, actorId: string) {
    return this.updateUserStatus(id, { status: UserStatus.BANNED }, actorId);
  }

  async reactivateUser(id: string, actorId: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    this.assertNotTargetingAdmin(actorId, user, 'modify status of');
    return this.updateUserStatus(id, { status: UserStatus.ACTIVE }, actorId);
  }

  async forceVerifyEmail(id: string, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    this.assertNotTargetingAdmin(actorId, user, 'force-verify');
    user.isEmailVerified = true;
    await this.userRepository.save(user);
    await this.auditService.log(AuditAction.EMAIL_VERIFY, actorId, user.email, {
      forcedByAdmin: true,
      targetUserId: id,
    });
    return { message: 'Email marked as verified', email: user.email };
  }

  async resetUserPassword(id: string, dto: AdminResetPasswordDto, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    this.assertNotTargetingAdmin(actorId, user, 'reset password for');
    user.password = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.save(user);
    await this.auditService.log(AuditAction.PASSWORD_RESET, actorId, user.email, {
      forcedByAdmin: true,
      targetUserId: id,
    });
    return { message: 'Password reset successfully' };
  }

  async updateUserRole(id: string, dto: UpdateUserRoleDto, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    this.assertNotTargetingAdmin(actorId, user, 'change the role of');
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot promote users to ADMIN through this endpoint');
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

  async softDeleteUser(id: string, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    this.assertNotTargetingAdmin(actorId, user, 'delete');

    user.deletedAt = new Date();
    user.status = UserStatus.BANNED;
    await this.userRepository.save(user);
    await this.auditService.log(AuditAction.USER_DELETED, actorId || id, user.email, {
      targetUserId: id,
    });
    return { message: 'User soft deleted' };
  }

  async restoreUser(id: string, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    this.assertNotTargetingAdmin(actorId, user, 'restore');

    user.deletedAt = null;
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);
    await this.auditService.log(AuditAction.USER_RESTORED, actorId || id, user.email, {
      targetUserId: id,
    });
    return { message: 'User restored' };
  }

  async approveSupplier(userId: string) {
    const profile = await this.supplierProfileRepository.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Supplier profile not found');

    profile.approvalStatus = ApprovalStatus.APPROVED;
    profile.verificationStatus = ApprovalStatus.APPROVED;
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

  async listSuppliers(page = 1, limit = 20) {
    const [items, total] = await this.supplierProfileRepository.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async listNgos(page = 1, limit = 20) {
    const [items, total] = await this.ngoRepository.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async broadcastAnnouncement(dto: BroadcastDto) {
    const where: any = { deletedAt: IsNull(), status: UserStatus.ACTIVE };
    if (dto.role) where.role = dto.role;

    const users = await this.userRepository.find({
      where,
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

  async moderatePost(postId: string, dto: ModeratePostDto, actorId?: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');

    if (dto.action === 'hide') {
      post.isHidden = true;
      post.isReported = true;
      await this.postRepository.save(post);
      await this.auditService.log(AuditAction.USER_SUSPENDED, actorId, post.user?.email, {
        action: 'hide_post',
        postId,
        reason: dto.reason,
      });
      return { message: 'Post hidden', postId };
    }

    if (dto.action === 'unhide') {
      post.isHidden = false;
      await this.postRepository.save(post);
      return { message: 'Post restored', postId };
    }

    await this.postRepository.remove(post);
    await this.auditService.log(AuditAction.USER_DELETED, actorId, post.user?.email, {
      action: 'delete_post',
      postId,
      reason: dto.reason,
    });
    return { message: 'Post deleted', postId };
  }

  async getReportedPosts(page = 1, limit = 20) {
    const [posts, total] = await this.postRepository.findAndCount({
      where: [{ isReported: true }, { isHidden: true }],
      relations: ['user'],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { posts, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
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

  async getPlatformOverview() {
    const farmStats = await this.getFarmStatistics();
    const pendingSuppliers = await this.supplierProfileRepository.count({
      where: { approvalStatus: ApprovalStatus.PENDING },
    });
    const pendingNgos = await this.ngoRepository.count({
      where: { approvalStatus: ApprovalStatus.PENDING },
    });
    const suspendedUsers = await this.userRepository.count({
      where: { status: UserStatus.SUSPENDED, deletedAt: IsNull() },
    });
    const bannedUsers = await this.userRepository.count({
      where: { status: UserStatus.BANNED, deletedAt: IsNull() },
    });
    const reportedPosts = await this.postRepository.count({
      where: { isReported: true },
    });
    const waitlist = await this.waitlistService.getStats();

    return {
      ...farmStats,
      pendingSuppliers,
      pendingNgos,
      suspendedUsers,
      bannedUsers,
      reportedPosts,
      waitlist,
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
