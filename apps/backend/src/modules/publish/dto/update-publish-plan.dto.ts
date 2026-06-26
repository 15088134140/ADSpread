import { PartialType } from '@nestjs/swagger';
import { CreatePublishPlanDto } from './create-publish-plan.dto';

export class UpdatePublishPlanDto extends PartialType(CreatePublishPlanDto) {}
