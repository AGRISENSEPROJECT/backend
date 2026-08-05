import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import {
  SupplierProfile,
  SupplierVerificationStatus,
} from '../entities/supplier-profile.entity';
import {
  CreateSupplierProfileDto,
  ListSuppliersQueryDto,
  UpdateSupplierProfileDto,
} from './dto/supplier-profile.dto';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(SupplierProfile)
    private readonly supplierProfileRepository: Repository<SupplierProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private toPublicProfile(profile: SupplierProfile) {
    return {
      id: profile.id,
      businessName: profile.businessName,
      description: profile.description,
      phone: profile.phone,
      country: profile.country,
      province: profile.province,
      district: profile.district,
      sector: profile.sector,
      cell: profile.cell,
      village: profile.village,
      address: profile.address,
      verificationStatus: profile.verificationStatus,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      user: profile.user
        ? {
            id: profile.user.id,
            username: profile.user.username,
            email: profile.user.email,
            status: profile.user.status,
            profileImage: profile.user.profileImage,
          }
        : undefined,
    };
  }

  async getMyProfile(userId: string) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!profile) {
      throw new NotFoundException(
        'Supplier profile not found. Create one with POST /api/suppliers/profile',
      );
    }

    return this.toPublicProfile(profile);
  }

  async createProfile(userId: string, dto: CreateSupplierProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.SUPPLIER) {
      throw new ForbiddenException('Only supplier accounts can create a supplier profile');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Suspended suppliers cannot create a profile');
    }

    const existing = await this.supplierProfileRepository.findOne({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Supplier profile already exists. Use PUT to update it.');
    }

    const profile = this.supplierProfileRepository.create({
      userId,
      businessName: dto.businessName,
      description: dto.description ?? null,
      phone: dto.phone ?? user.phoneNumber ?? null,
      country: dto.country ?? null,
      province: dto.province ?? null,
      district: dto.district ?? null,
      sector: dto.sector ?? null,
      cell: dto.cell ?? null,
      village: dto.village ?? null,
      address: dto.address ?? null,
      verificationStatus: SupplierVerificationStatus.PENDING,
    });

    await this.supplierProfileRepository.save(profile);

    const saved = await this.supplierProfileRepository.findOne({
      where: { id: profile.id },
      relations: ['user'],
    });

    return {
      message:
        'Supplier profile created successfully. Waiting for admin approval.',
      profile: this.toPublicProfile(saved!),
    };
  }

  async updateProfile(userId: string, dto: UpdateSupplierProfileDto) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!profile) {
      throw new NotFoundException('Supplier profile not found');
    }

    if (profile.user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Suspended suppliers cannot update their profile');
    }

    Object.assign(profile, {
      ...(dto.businessName !== undefined
        ? { businessName: dto.businessName }
        : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.country !== undefined ? { country: dto.country } : {}),
      ...(dto.province !== undefined ? { province: dto.province } : {}),
      ...(dto.district !== undefined ? { district: dto.district } : {}),
      ...(dto.sector !== undefined ? { sector: dto.sector } : {}),
      ...(dto.cell !== undefined ? { cell: dto.cell } : {}),
      ...(dto.village !== undefined ? { village: dto.village } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
    });

    // Edits after rejection put the profile back into review
    if (profile.verificationStatus === SupplierVerificationStatus.REJECTED) {
      profile.verificationStatus = SupplierVerificationStatus.PENDING;
      profile.user.status = UserStatus.PENDING;
      await this.userRepository.save(profile.user);
    }

    await this.supplierProfileRepository.save(profile);

    return {
      message: 'Supplier profile updated successfully',
      profile: this.toPublicProfile(profile),
    };
  }

  async listApprovedProfiles(query: ListSuppliersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {
      verificationStatus: SupplierVerificationStatus.APPROVED,
    };

    if (query.search) {
      where.businessName = ILike(`%${query.search}%`);
    }

    const [items, total] = await this.supplierProfileRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Only expose suppliers whose account is active
    const visible = items.filter(
      (item) => item.user?.status === UserStatus.ACTIVE,
    );

    return {
      items: visible.map((item) => this.toPublicProfile(item)),
      total,
      page,
      limit,
    };
  }

  async getPublicProfile(profileId: string, actor?: User) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { id: profileId },
      relations: ['user'],
    });

    if (!profile) {
      throw new NotFoundException('Supplier profile not found');
    }

    const isOwner = actor?.id === profile.userId;
    const isAdmin = actor?.role === UserRole.ADMIN;
    const isApproved =
      profile.verificationStatus === SupplierVerificationStatus.APPROVED &&
      profile.user?.status === UserStatus.ACTIVE;

    if (!isApproved && !isOwner && !isAdmin) {
      throw new NotFoundException('Supplier profile not found');
    }

    return this.toPublicProfile(profile);
  }

  async markApproved(userId: string) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new BadRequestException(
        'Supplier must create a business profile before approval',
      );
    }

    profile.verificationStatus = SupplierVerificationStatus.APPROVED;
    await this.supplierProfileRepository.save(profile);
    return profile;
  }

  async markRejected(userId: string) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { userId },
    });

    if (profile) {
      profile.verificationStatus = SupplierVerificationStatus.REJECTED;
      await this.supplierProfileRepository.save(profile);
    }

    return profile;
  }
}
