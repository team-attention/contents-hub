import { UserId } from "@/common/decorators/user.decorator";
import { Auth } from "@/modules/auth/decorators/auth.decorator";
import { OrchestratorService } from "@/modules/orchestrator/orchestrator.service";
import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { DigestService } from "./digest.service";
import {
  DigestListResponseDto,
  DigestResponseDto,
  TriggerDigestResponseDto,
} from "./dto/digest-response.dto";

@ApiTags("Digests")
@Controller("digests")
export class DigestController {
  constructor(
    private readonly digestService: DigestService,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  @Post("trigger")
  @Auth()
  @ApiOperation({ summary: "Trigger digest pipeline for current user" })
  @ApiResponse({ status: 200, type: TriggerDigestResponseDto })
  async triggerDigest(@UserId() userId: string): Promise<TriggerDigestResponseDto> {
    const result = await this.orchestratorService.runFullPipeline(userId);

    const successfulFetches = result.fetchResults.filter((r) => r.success).length;
    const successfulSummarizes = result.summarizeResults.filter((r) => r.success).length;

    if (!result.digestResult?.success) {
      return {
        success: false,
        fetchedCount: successfulFetches,
        summarizedCount: successfulSummarizes,
        message: result.digestResult?.errorMessage ?? "No items to digest",
      };
    }

    const digest = await this.digestService.findById(userId, result.digestResult.digestId!);

    return {
      success: true,
      digest,
      fetchedCount: successfulFetches,
      summarizedCount: successfulSummarizes,
    };
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: "Get all digests for current user" })
  @ApiResponse({ status: 200, type: DigestListResponseDto })
  async findAll(@UserId() userId: string): Promise<DigestListResponseDto> {
    return this.digestService.findAll(userId);
  }

  @Get("today")
  @Auth()
  @ApiOperation({ summary: "Get today's digest" })
  @ApiResponse({ status: 200, type: DigestResponseDto })
  async findToday(@UserId() userId: string): Promise<DigestResponseDto | null> {
    return this.digestService.findToday(userId);
  }

  @Get(":id")
  @Auth()
  @ApiOperation({ summary: "Get a specific digest by ID" })
  @ApiResponse({ status: 200, type: DigestResponseDto })
  async findById(@UserId() userId: string, @Param("id") id: string): Promise<DigestResponseDto> {
    return this.digestService.findById(userId, id);
  }
}
