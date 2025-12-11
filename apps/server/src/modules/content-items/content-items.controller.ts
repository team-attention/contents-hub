import { UserId } from "@/common/decorators/user.decorator";
import { Auth } from "@/modules/auth/decorators/auth.decorator";
import type { ContentItemStatus } from "@contents-hub/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ContentItemsService } from "./content-items.service";
import {
  ContentItemListResponseDto,
  ContentItemResponseDto,
} from "./dto/content-item-response.dto";
import { CreateContentItemDto } from "./dto/create-content-item.dto";
import { UpdateContentItemDto } from "./dto/update-content-item.dto";

@Controller("content-items")
@ApiTags("content-items")
@Auth()
export class ContentItemsController {
  constructor(private readonly contentItemsService: ContentItemsService) {}

  @Get()
  @ApiOperation({ summary: "Get all content items for current user" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["pending", "ready", "done", "archived", "error"],
  })
  @ApiResponse({ status: 200, type: ContentItemListResponseDto })
  findAll(
    @UserId() userId: string,
    @Query("status") status?: ContentItemStatus,
  ): Promise<ContentItemListResponseDto> {
    return this.contentItemsService.findAll(userId, status);
  }

  @Get("by-url")
  @ApiOperation({ summary: "Find content item by URL" })
  @ApiQuery({ name: "url", description: "URL to search for" })
  @ApiResponse({ status: 200, type: ContentItemResponseDto })
  findByUrl(
    @UserId() userId: string,
    @Query("url") url: string,
  ): Promise<ContentItemResponseDto | null> {
    return this.contentItemsService.findByUrl(userId, url);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a content item by ID" })
  @ApiResponse({ status: 200, type: ContentItemResponseDto })
  @ApiResponse({ status: 404, description: "Content item not found" })
  findById(@UserId() userId: string, @Param("id") id: string): Promise<ContentItemResponseDto> {
    return this.contentItemsService.findById(userId, id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new content item (read later)" })
  @ApiResponse({ status: 201, type: ContentItemResponseDto })
  create(
    @UserId() userId: string,
    @Body() dto: CreateContentItemDto,
  ): Promise<ContentItemResponseDto> {
    return this.contentItemsService.create(userId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a content item" })
  @ApiResponse({ status: 200, type: ContentItemResponseDto })
  @ApiResponse({ status: 404, description: "Content item not found" })
  update(
    @UserId() userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateContentItemDto,
  ): Promise<ContentItemResponseDto> {
    return this.contentItemsService.update(userId, id, dto);
  }

  @Patch(":id/archive")
  @ApiOperation({ summary: "Archive a content item" })
  @ApiResponse({ status: 200, type: ContentItemResponseDto })
  archive(@UserId() userId: string, @Param("id") id: string): Promise<ContentItemResponseDto> {
    return this.contentItemsService.updateStatus(userId, id, "archived");
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a content item" })
  @ApiResponse({ status: 204, description: "Content item deleted" })
  delete(@UserId() userId: string, @Param("id") id: string): Promise<void> {
    return this.contentItemsService.delete(userId, id);
  }
}
