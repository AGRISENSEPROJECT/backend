import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import {
  Organization,
  OrganizationType,
  OrganizationVerificationStatus,
} from '../entities/organization.entity';
import {
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private toResponse(org: Organization) {
    return {
      id: org.id,
      type: org.type,
      name: org.name,
      description: org.description,
      phone: org.phone,
      country: org.country,
      province: org.province,
      district: org.district,
      assignedRegions: org.assignedRegions,
      verificationStatus: org.verificationStatus,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      user: org.user
        ? {
            id: org.user.id,
            username: org.user.username,
            email: org.user.email,
            role: org.user.role,
            status: org.user.status,
          }
        : undefined,
    };
  }

  private roleToOrgType(role: UserRole): OrganizationType {
    if (role === UserRole.NGO) return OrganizationType.NGO;
    if (role === UserRole.GOVERNMENT) return OrganizationType.GOVERNMENT;
    throw new ForbiddenException('Only NGO or Government accounts can manage organizations');
  }

  async getMyOrganization(user: User) {
    const org = await this.organizationRepository.findOne({
      where: { userId: user.id },
      relations: ['user'],
    });

    if (!org) {
      throw new NotFoundException(
        'Organization profile not found. Create one with POST /api/organizations/profile',
      );
    }

    return this.toResponse(org);
  }

  async createProfile(user: User, dto: CreateOrganizationDto) {
    if (user.role !== UserRole.NGO && user.role !== UserRole.GOVERNMENT) {
      throw new ForbiddenException('Only NGO or Government accounts can create an organization');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Suspended accounts cannot create an organization');
    }

    const existing = await this.organizationRepository.findOne({
      where: { userId: user.id },
    });
    if (existing) {
      throw new ConflictException('Organization profile already exists');
    }

    const org = this.organizationRepository.create({
      userId: user.id,
      type: this.roleToOrgType(user.role),
      name: dto.name,
      description: dto.description ?? null,
      phone: dto.phone ?? user.phoneNumber ?? null,
      country: dto.country ?? 'Rwanda',
      province: dto.province ?? null,
      district: dto.district ?? null,
      assignedRegions: dto.assignedRegions ?? null,
      verificationStatus: OrganizationVerificationStatus.PENDING,
    });

    await this.organizationRepository.save(org);

    const saved = await this.organizationRepository.findOne({
      where: { id: org.id },
      relations: ['user'],
    });

    return {
      message:
        'Organization profile created. Waiting for admin approval.',
      organization: this.toResponse(saved!),
    };
  }

  async updateProfile(user: User, dto: UpdateOrganizationDto) {
    const org = await this.organizationRepository.findOne({
      where: { userId: user.id },
      relations: ['user'],
    });

    if (!org) {
      throw new NotFoundException('Organization profile not found');
    }

    if (org.user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Suspended accounts cannot update organization');
    }

    Object.assign(org, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.country !== undefined ? { country: dto.country } : {}),
      ...(dto.province !== undefined ? { province: dto.province } : {}),
      ...(dto.district !== undefined ? { district: dto.district } : {}),
      ...(dto.assignedRegions !== undefined
        ? { assignedRegions: dto.assignedRegions }
        : {}),
    });

    if (org.verificationStatus === OrganizationVerificationStatus.REJECTED) {
      org.verificationStatus = OrganizationVerificationStatus.PENDING;
      org.user.status = UserStatus.PENDING;
      await this.userRepository.save(org.user);
    }

    await this.organizationRepository.save(org);

    return {
      message: 'Organization profile updated successfully',
      organization: this.toResponse(org),
    };
  }

  async listApproved(query: ListOrganizationsQueryDto) {
    const orgs = await this.organizationRepository.find({
      where: {
        verificationStatus: OrganizationVerificationStatus.APPROVED,
        ...(query.type ? { type: query.type } : {}),
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return {
      count: orgs.length,
      items: orgs
        .filter((org) => org.user?.status === UserStatus.ACTIVE)
        .map((org) => this.toResponse(org)),
    };
  }

  async getById(id: string, actor?: User) {
    const org = await this.organizationRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const isOwner = actor?.id === org.userId;
    const isAdmin = actor?.role === UserRole.ADMIN;
    const isPublic =
      org.verificationStatus === OrganizationVerificationStatus.APPROVED &&
      org.user?.status === UserStatus.ACTIVE;

    if (!isPublic && !isOwner && !isAdmin) {
      throw new NotFoundException('Organization not found');
    }

    return this.toResponse(org);
  }

  async markApproved(userId: string) {
    const org = await this.organizationRepository.findOne({
      where: { userId },
    });

    if (!org) {
      throw new BadRequestException(
        'Organization profile must be created before approval',
      );
    }

    org.verificationStatus = OrganizationVerificationStatus.APPROVED;
    await this.organizationRepository.save(org);
    return org;
  }

  async markRejected(userId: string) {
    const org = await this.organizationRepository.findOne({
      where: { userId },
    });

    if (org) {
      org.verificationStatus = OrganizationVerificationStatus.REJECTED;
      await this.organizationRepository.save(org);
    }

    return org;
  }

  async requireApprovedOrgForUser(user: User) {
    const org = await this.organizationRepository.findOne({
      where: { userId: user.id },
      relations: ['user'],
    });

    if (!org) {
      throw new BadRequestException('Create an organization profile first');
    }

    if (
      org.verificationStatus !== OrganizationVerificationStatus.APPROVED ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        'Organization must be approved and active for this action',
      );
    }

    return org;
  }
}
