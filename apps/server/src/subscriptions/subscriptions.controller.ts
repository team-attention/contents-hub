import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Auth } from "../auth/decorators/auth.decorator";
import { UserId } from "../common/decorators/user.decorator";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import {
  SubscriptionListResponseDto,
  SubscriptionResponseDto,
} from "./dto/subscription-response.dto";
import { SubscriptionsService } from "./subscriptions.service";

@Controller("subscriptions")
@ApiTags("subscriptions")
@Auth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: "Get all subscriptions for current user" })
  @ApiResponse({ status: 200, type: SubscriptionListResponseDto })
  findAll(@UserId() userId: string): Promise<SubscriptionListResponseDto> {
    return this.subscriptionsService.findAll(userId);
  }

  @Get("by-url")
  @ApiOperation({ summary: "Find subscription by URL" })
  @ApiQuery({ name: "url", description: "URL to search for" })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  findByUrl(
    @UserId() userId: string,
    @Query("url") url: string,
  ): Promise<SubscriptionResponseDto | null> {
    return this.subscriptionsService.findByUrl(userId, url);
  }

  @Post()
  @ApiOperation({ summary: "Create a new subscription" })
  @ApiResponse({ status: 201, type: SubscriptionResponseDto })
  create(
    @UserId() userId: string,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.create(userId, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a subscription" })
  @ApiResponse({ status: 204, description: "Subscription deleted" })
  delete(@UserId() userId: string, @Param("id") id: string): Promise<void> {
    return this.subscriptionsService.delete(userId, id);
  }
}
