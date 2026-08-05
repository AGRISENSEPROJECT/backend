import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cooperative } from '../entities/cooperative.entity';
import {
  CooperativeMember,
  CooperativeMemberRole,
} from '../entities/cooperative-member.entity';
import { User, UserRole } from '../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import {
  AddMemberDto,
  CreateCooperativeDto,
  UpdateMemberRoleDto,
} from './dto/cooperative.dto';

@Injectable()
export class CooperativeService {
  constructor(
    @InjectRepository(Cooperative)
    private readonly cooperativeRepository: Repository<Cooperative>,
    @InjectRepository(CooperativeMember)
    private readonly memberRepository: Repository<CooperativeMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  private isAdmin(role?: UserRole) {
    return role === UserRole.ADMIN;
  }

  async create(userId: string, dto: CreateCooperativeDto) {
    const cooperative = await this.cooperativeRepository.save(
      this.cooperativeRepository.create({
        name: dto.name,
        description: dto.description ?? null,
        province: dto.province ?? null,
        district: dto.district ?? null,
        chairUserId: userId,
      }),
    );

    await this.memberRepository.save(
      this.memberRepository.create({
        cooperativeId: cooperative.id,
        userId,
        role: CooperativeMemberRole.CHAIR,
      }),
    );

    await this.auditService.log({
      actorId: userId,
      action: 'cooperative.create',
      resource: 'cooperative',
      resourceId: cooperative.id,
      metadata: { name: cooperative.name },
    });

    return { message: 'Cooperative created', cooperative };
  }

  async list() {
    const cooperatives = await this.cooperativeRepository.find({
      relations: ['chair'],
      order: { createdAt: 'DESC' },
    });
    return { count: cooperatives.length, cooperatives };
  }

  async get(id: string) {
    const cooperative = await this.cooperativeRepository.findOne({
      where: { id },
      relations: ['chair', 'members', 'members.user'],
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }
    return cooperative;
  }

  async join(userId: string, cooperativeId: string) {
    const cooperative = await this.cooperativeRepository.findOne({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    const existing = await this.memberRepository.findOne({
      where: { cooperativeId, userId },
    });
    if (existing) {
      throw new ConflictException('Already a member');
    }

    const member = await this.memberRepository.save(
      this.memberRepository.create({
        cooperativeId,
        userId,
        role: CooperativeMemberRole.MEMBER,
      }),
    );

    return { message: 'Joined cooperative', member };
  }

  async leave(userId: string, cooperativeId: string) {
    const member = await this.memberRepository.findOne({
      where: { cooperativeId, userId },
    });
    if (!member) {
      throw new NotFoundException('Membership not found');
    }
    if (member.role === CooperativeMemberRole.CHAIR) {
      throw new ForbiddenException('Chair cannot leave; transfer chair first');
    }

    await this.memberRepository.remove(member);
    return { message: 'Left cooperative' };
  }

  async addMember(
    actorId: string,
    role: UserRole,
    cooperativeId: string,
    dto: AddMemberDto,
  ) {
    await this.assertCanManage(actorId, role, cooperativeId);

    const user = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.memberRepository.findOne({
      where: { cooperativeId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('User is already a member');
    }

    const member = await this.memberRepository.save(
      this.memberRepository.create({
        cooperativeId,
        userId: dto.userId,
        role: dto.role ?? CooperativeMemberRole.MEMBER,
      }),
    );

    return { message: 'Member added', member };
  }

  async updateMemberRole(
    actorId: string,
    role: UserRole,
    cooperativeId: string,
    memberUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.assertCanManage(actorId, role, cooperativeId);

    const member = await this.memberRepository.findOne({
      where: { cooperativeId, userId: memberUserId },
    });
    if (!member) {
      throw new NotFoundException('Membership not found');
    }

    member.role = dto.role;
    await this.memberRepository.save(member);

    if (dto.role === CooperativeMemberRole.CHAIR) {
      await this.cooperativeRepository.update(cooperativeId, {
        chairUserId: memberUserId,
      });
    }

    return { message: 'Member role updated', member };
  }

  async removeMember(
    actorId: string,
    role: UserRole,
    cooperativeId: string,
    memberUserId: string,
  ) {
    await this.assertCanManage(actorId, role, cooperativeId);

    const member = await this.memberRepository.findOne({
      where: { cooperativeId, userId: memberUserId },
    });
    if (!member) {
      throw new NotFoundException('Membership not found');
    }
    if (member.role === CooperativeMemberRole.CHAIR) {
      throw new ForbiddenException('Cannot remove chair directly');
    }

    await this.memberRepository.remove(member);
    return { message: 'Member removed' };
  }

  private async assertCanManage(
    actorId: string,
    role: UserRole,
    cooperativeId: string,
  ) {
    if (this.isAdmin(role)) {
      return;
    }

    const membership = await this.memberRepository.findOne({
      where: { cooperativeId, userId: actorId },
    });

    if (
      !membership ||
      ![CooperativeMemberRole.CHAIR, CooperativeMemberRole.OFFICER].includes(
        membership.role,
      )
    ) {
      throw new ForbiddenException('Only chair/officer/admin can manage members');
    }
  }
}
