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
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { ProgramService } from './program.service';
import {
  AssignFarmerDto,
  CreateProgramDto,
  ListProgramsQueryDto,
  UpdateProgramDto,
} from './dto/program.dto';

@ApiTags('Programs')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Post()
  @Roles(UserRole.NGO)
  @ApiOperation({ summary: 'Create an NGO support program' })
  create(@Req() req: Request, @Body() dto: CreateProgramDto) {
    return this.programService.create(this.getActor(req), dto);
  }

  @Get('me')
  @Roles(UserRole.NGO)
  @ApiOperation({ summary: 'List my NGO programs' })
  listMine(@Req() req: Request, @Query() query: ListProgramsQueryDto) {
    return this.programService.listMine(this.getActor(req), query);
  }

  @Get()
  @Roles(
    UserRole.FARMER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'List active public programs' })
  listPublic(@Query() query: ListProgramsQueryDto) {
    return this.programService.listPublic(query);
  }

  @Get(':id')
  @Roles(
    UserRole.FARMER,
    UserRole.NGO,
    UserRole.GOVERNMENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get program details' })
  getOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.programService.getOne(this.getActor(req), id);
  }

  @Put(':id')
  @Roles(UserRole.NGO)
  @ApiOperation({ summary: 'Update my NGO program' })
  update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.programService.update(this.getActor(req), id, dto);
  }

  @Post(':id/farmers')
  @Roles(UserRole.NGO)
  @ApiOperation({ summary: 'Assign a farmer to a program' })
  assignFarmer(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignFarmerDto,
  ) {
    return this.programService.assignFarmer(this.getActor(req), id, dto);
  }

  @Delete(':id/farmers/:farmerId')
  @Roles(UserRole.NGO)
  @ApiOperation({ summary: 'Remove a farmer from a program' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'farmerId' })
  removeFarmer(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('farmerId', ParseUUIDPipe) farmerId: string,
  ) {
    return this.programService.removeFarmer(this.getActor(req), id, farmerId);
  }
}
