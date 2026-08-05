import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program, ProgramStatus } from '../entities/program.entity';
import { ProgramFarmer } from '../entities/program-farmer.entity';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { OrganizationService } from '../organization/organization.service';
import {
  AssignFarmerDto,
  CreateProgramDto,
  ListProgramsQueryDto,
  UpdateProgramDto,
} from './dto/program.dto';

@Injectable()
export class ProgramService {
  constructor(
    @InjectRepository(Program)
    private readonly programRepository: Repository<Program>,
    @InjectRepository(ProgramFarmer)
    private readonly programFarmerRepository: Repository<ProgramFarmer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly organizationService: OrganizationService,
  ) {}

  private toProgramResponse(program: Program, assignedCount?: number) {
    return {
      id: program.id,
      organizationId: program.organizationId,
      title: program.title,
      description: program.description,
      province: program.province,
      district: program.district,
      status: program.status,
      startDate: program.startDate,
      endDate: program.endDate,
      targetFarmers: program.targetFarmers,
      assignedFarmers: assignedCount ?? program.programFarmers?.length ?? 0,
      organization: program.organization
        ? {
            id: program.organization.id,
            name: program.organization.name,
            type: program.organization.type,
          }
        : undefined,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    };
  }

  async create(user: User, dto: CreateProgramDto) {
    if (user.role !== UserRole.NGO) {
      throw new ForbiddenException('Only NGO accounts can create programs');
    }

    const organization =
      await this.organizationService.requireApprovedOrgForUser(user);

    const program = this.programRepository.create({
      organizationId: organization.id,
      title: dto.title,
      description: dto.description ?? null,
      province: dto.province ?? organization.province ?? null,
      district: dto.district ?? organization.district ?? null,
      status: dto.status ?? ProgramStatus.DRAFT,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      targetFarmers: dto.targetFarmers ?? 0,
    });

    await this.programRepository.save(program);

    return {
      message: 'Program created successfully',
      program: this.toProgramResponse(program, 0),
    };
  }

  async update(user: User, programId: string, dto: UpdateProgramDto) {
    const organization =
      await this.organizationService.requireApprovedOrgForUser(user);

    const program = await this.programRepository.findOne({
      where: { id: programId, organizationId: organization.id },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    Object.assign(program, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.province !== undefined ? { province: dto.province } : {}),
      ...(dto.district !== undefined ? { district: dto.district } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.targetFarmers !== undefined
        ? { targetFarmers: dto.targetFarmers }
        : {}),
    });

    await this.programRepository.save(program);

    return {
      message: 'Program updated successfully',
      program: this.toProgramResponse(program),
    };
  }

  async listMine(user: User, query: ListProgramsQueryDto) {
    const organization =
      await this.organizationService.requireApprovedOrgForUser(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.programRepository.findAndCount({
      where: {
        organizationId: organization.id,
        ...(query.status ? { status: query.status } : {}),
      },
      relations: ['programFarmers'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) =>
        this.toProgramResponse(item, item.programFarmers?.length ?? 0),
      ),
      total,
      page,
      limit,
    };
  }

  async listPublic(query: ListProgramsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.programRepository.findAndCount({
      where: {
        status: query.status ?? ProgramStatus.ACTIVE,
      },
      relations: ['organization', 'programFarmers'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) =>
        this.toProgramResponse(item, item.programFarmers?.length ?? 0),
      ),
      total,
      page,
      limit,
    };
  }

  async getOne(actor: User, programId: string) {
    const program = await this.programRepository.findOne({
      where: { id: programId },
      relations: ['organization', 'programFarmers', 'programFarmers.farmer'],
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const isOwner = program.organization?.userId === actor.id;
    const isAdmin = actor.role === UserRole.ADMIN;
    const isGov = actor.role === UserRole.GOVERNMENT;
    const isPublic = program.status === ProgramStatus.ACTIVE;

    if (!isOwner && !isAdmin && !isGov && !isPublic) {
      throw new NotFoundException('Program not found');
    }

    return {
      ...this.toProgramResponse(program, program.programFarmers?.length ?? 0),
      farmers:
        isOwner || isAdmin
          ? (program.programFarmers ?? []).map((pf) => ({
              id: pf.id,
              farmerId: pf.farmerId,
              notes: pf.notes,
              assignedAt: pf.assignedAt,
              farmer: pf.farmer
                ? {
                    id: pf.farmer.id,
                    username: pf.farmer.username,
                    email: pf.farmer.email,
                    phoneNumber: pf.farmer.phoneNumber,
                  }
                : undefined,
            }))
          : undefined,
    };
  }

  async assignFarmer(user: User, programId: string, dto: AssignFarmerDto) {
    const organization =
      await this.organizationService.requireApprovedOrgForUser(user);

    const program = await this.programRepository.findOne({
      where: { id: programId, organizationId: organization.id },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const farmer = await this.userRepository.findOne({
      where: { id: dto.farmerId, role: UserRole.FARMER },
    });

    if (!farmer || farmer.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Active farmer account not found');
    }

    const existing = await this.programFarmerRepository.findOne({
      where: { programId, farmerId: dto.farmerId },
    });
    if (existing) {
      throw new BadRequestException('Farmer already assigned to this program');
    }

    const assignment = this.programFarmerRepository.create({
      programId,
      farmerId: dto.farmerId,
      notes: dto.notes ?? null,
    });
    await this.programFarmerRepository.save(assignment);

    return {
      message: 'Farmer assigned to program',
      assignment: {
        id: assignment.id,
        programId,
        farmerId: dto.farmerId,
        notes: assignment.notes,
        assignedAt: assignment.assignedAt,
      },
    };
  }

  async removeFarmer(user: User, programId: string, farmerId: string) {
    const organization =
      await this.organizationService.requireApprovedOrgForUser(user);

    const program = await this.programRepository.findOne({
      where: { id: programId, organizationId: organization.id },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const assignment = await this.programFarmerRepository.findOne({
      where: { programId, farmerId },
    });

    if (!assignment) {
      throw new NotFoundException('Farmer assignment not found');
    }

    await this.programFarmerRepository.remove(assignment);
    return { message: 'Farmer removed from program' };
  }
}
