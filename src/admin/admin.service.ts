import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { Farm } from '../entities/farm.entity';
import { Post } from '../entities/post.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import {
  AdminUsersQueryDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/admin-user.dto';
import { SupplierService } from '../supplier/supplier.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { OrganizationService } from '../organization/organization.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PredictionRun)
    private readonly predictionRunRepository: Repository<PredictionRun>,
    private readonly supplierService: SupplierService,
    private readonly notificationService: NotificationService,
    private readonly organizationService: OrganizationService,
    private readonly auditService: AuditService,
  ) {}

  private sanitizeUser(user: User) {
    const {
      password: _password,
      emailVerificationToken: _emailVerificationToken,
      resetPasswordToken: _resetPasswordToken,
      ...safe
    } = user;
    return safe;
  }

  async listUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown>[] = [];
    const base: Record<string, unknown> = {};

    if (query.role) base.role = query.role;
    if (query.status) base.status = query.status;

    if (query.search) {
      where.push(
        { ...base, email: ILike(`%${query.search}%`) },
        { ...base, username: ILike(`%${query.search}%`) },
      );
    } else {
      where.push(base);
    }

    const [users, total] = await this.userRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: users.map((user) => this.sanitizeUser(user)),
      total,
      page,
      limit,
    };
  }

  async getUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['farms', 'supplierProfile', 'organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async updateUserStatus(
    actorId: string,
    userId: string,
    dto: UpdateUserStatusDto,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id === actorId && dto.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('Admins cannot suspend their own account');
    }

    if (
      user.role === UserRole.ADMIN &&
      dto.status === UserStatus.SUSPENDED
    ) {
      await this.assertNotLastActiveAdmin(user.id);
    }

    user.status = dto.status;
    await this.userRepository.save(user);

    await this.auditService.log({
      actorId,
      action: 'admin.user.update_status',
      resource: 'user',
      resourceId: user.id,
      metadata: { status: dto.status },
    });

    return {
      message: `User status updated to ${dto.status}`,
      user: this.sanitizeUser(user),
    };
  }

  async updateUserRole(
    actorId: string,
    userId: string,
    dto: UpdateUserRoleDto,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id === actorId && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admins cannot remove their own admin role');
    }

    if (user.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      await this.assertNotLastActiveAdmin(user.id);
    }

    user.role = dto.role;

    // Promoting to admin activates the account
    if (dto.role === UserRole.ADMIN) {
      user.status = UserStatus.ACTIVE;
      user.isEmailVerified = true;
    }

    // Demoting a supplier back to farmer keeps status as-is unless suspended
    await this.userRepository.save(user);

    await this.auditService.log({
      actorId,
      action: 'admin.user.update_role',
      resource: 'user',
      resourceId: user.id,
      metadata: { role: dto.role },
    });

    return {
      message: `User role updated to ${dto.role}`,
      user: this.sanitizeUser(user),
    };
  }

  async listSuppliers(status?: UserStatus) {
    const suppliers = await this.userRepository.find({
      where: {
        role: UserRole.SUPPLIER,
        ...(status ? { status } : {}),
      },
      relations: ['supplierProfile'],
      order: { createdAt: 'DESC' },
    });

    return {
      count: suppliers.length,
      items: suppliers.map((user) => this.sanitizeUser(user)),
    };
  }

  async approveSupplier(userId: string) {
    const user = await this.requireSupplier(userId);

    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException(
        'Cannot approve a suspended supplier. Reactivate the account first.',
      );
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Supplier email must be verified before approval',
      );
    }

    await this.supplierService.markApproved(userId);

    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);

    await this.notificationService.create({
      userId,
      type: NotificationType.SUPPLIER_APPROVED,
      title: 'Supplier account approved',
      message:
        'Your supplier account has been approved. You can now add products and sell on AgriSense.',
      data: { userId },
    });

    await this.auditService.log({
      action: 'admin.supplier.approve',
      resource: 'user',
      resourceId: userId,
    });

    const refreshed = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['supplierProfile'],
    });

    return {
      message: 'Supplier approved successfully',
      user: this.sanitizeUser(refreshed!),
    };
  }

  async rejectSupplier(userId: string) {
    const user = await this.requireSupplier(userId);

    await this.supplierService.markRejected(userId);

    user.status = UserStatus.SUSPENDED;
    await this.userRepository.save(user);

    await this.notificationService.create({
      userId,
      type: NotificationType.SUPPLIER_REJECTED,
      title: 'Supplier account rejected',
      message:
        'Your supplier account was rejected. Update your profile and contact support if you believe this is a mistake.',
      data: { userId },
    });

    await this.auditService.log({
      action: 'admin.supplier.reject',
      resource: 'user',
      resourceId: userId,
    });

    const refreshed = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['supplierProfile'],
    });

    return {
      message: 'Supplier rejected and suspended',
      user: this.sanitizeUser(refreshed!),
    };
  }

  async listOrganizations(role?: UserRole.NGO | UserRole.GOVERNMENT, status?: UserStatus) {
    const roles = role
      ? [role]
      : [UserRole.NGO, UserRole.GOVERNMENT];

    const users = await this.userRepository.find({
      where: {
        role: In(roles),
        ...(status ? { status } : {}),
      },
      relations: ['organization'],
      order: { createdAt: 'DESC' },
    });

    return {
      count: users.length,
      items: users.map((user) => this.sanitizeUser(user)),
    };
  }

  async approveOrganization(userId: string) {
    const user = await this.requireOrganizationUser(userId);

    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException(
        'Cannot approve a suspended account. Reactivate first.',
      );
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Email must be verified before organization approval',
      );
    }

    await this.organizationService.markApproved(userId);

    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);

    await this.notificationService.create({
      userId,
      type: NotificationType.ORGANIZATION_APPROVED,
      title: 'Organization approved',
      message: `Your ${user.role} organization account has been approved.`,
      data: { userId, role: user.role },
    });

    await this.auditService.log({
      action: 'admin.organization.approve',
      resource: 'user',
      resourceId: userId,
      metadata: { role: user.role },
    });

    const refreshed = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    });

    return {
      message: 'Organization approved successfully',
      user: this.sanitizeUser(refreshed!),
    };
  }

  async rejectOrganization(userId: string) {
    const user = await this.requireOrganizationUser(userId);

    await this.organizationService.markRejected(userId);

    user.status = UserStatus.SUSPENDED;
    await this.userRepository.save(user);

    await this.notificationService.create({
      userId,
      type: NotificationType.ORGANIZATION_REJECTED,
      title: 'Organization rejected',
      message: `Your ${user.role} organization account was rejected.`,
      data: { userId, role: user.role },
    });

    await this.auditService.log({
      action: 'admin.organization.reject',
      resource: 'user',
      resourceId: userId,
      metadata: { role: user.role },
    });

    const refreshed = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    });

    return {
      message: 'Organization rejected and suspended',
      user: this.sanitizeUser(refreshed!),
    };
  }

  async getStats() {
    const [
      totalUsers,
      farmers,
      suppliers,
      ngos,
      government,
      admins,
      pendingSuppliers,
      pendingOrganizations,
      activeUsers,
      suspendedUsers,
      totalFarms,
      totalPosts,
      totalPredictionRuns,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: UserRole.FARMER } }),
      this.userRepository.count({ where: { role: UserRole.SUPPLIER } }),
      this.userRepository.count({ where: { role: UserRole.NGO } }),
      this.userRepository.count({ where: { role: UserRole.GOVERNMENT } }),
      this.userRepository.count({ where: { role: UserRole.ADMIN } }),
      this.userRepository.count({
        where: { role: UserRole.SUPPLIER, status: UserStatus.PENDING },
      }),
      this.userRepository.count({
        where: {
          role: In([UserRole.NGO, UserRole.GOVERNMENT]),
          status: UserStatus.PENDING,
        },
      }),
      this.userRepository.count({ where: { status: UserStatus.ACTIVE } }),
      this.userRepository.count({ where: { status: UserStatus.SUSPENDED } }),
      this.farmRepository.count(),
      this.postRepository.count(),
      this.predictionRunRepository.count(),
    ]);

    return {
      users: {
        total: totalUsers,
        farmers,
        suppliers,
        ngos,
        government,
        admins,
        pendingSuppliers,
        pendingOrganizations,
        active: activeUsers,
        suspended: suspendedUsers,
      },
      farms: { total: totalFarms },
      community: { posts: totalPosts },
      predictions: { runs: totalPredictionRuns },
    };
  }

  private async requireOrganizationUser(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.NGO && user.role !== UserRole.GOVERNMENT) {
      throw new BadRequestException('User is not an NGO or Government account');
    }
    return user;
  }

  private async requireSupplier(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.SUPPLIER) {
      throw new BadRequestException('User is not a supplier');
    }
    return user;
  }

  private async assertNotLastActiveAdmin(userId: string) {
    const activeAdmins = await this.userRepository.count({
      where: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    if (activeAdmins <= 1) {
      throw new ForbiddenException('Cannot modify the last active admin');
    }

    // Ensure the target is actually counted (already filtered above)
    void userId;
  }
}
