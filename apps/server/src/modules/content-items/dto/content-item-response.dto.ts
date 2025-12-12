import type { ContentItemSource, ContentItemStatus } from "@contents-hub/shared";
import { ApiProperty } from "@nestjs/swagger";

export class ContentItemResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  id: string;

  @ApiProperty({ example: "https://example.com/article" })
  url: string;

  @ApiProperty({ example: "Article Title", nullable: true })
  title: string | null;

  @ApiProperty({
    enum: ["pending", "ready", "done", "archived", "error"],
    example: "pending",
  })
  status: ContentItemStatus;

  @ApiProperty({
    enum: ["read_later", "subscription"],
    example: "read_later",
  })
  source: ContentItemSource;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000", nullable: true })
  subscriptionId: string | null;

  @ApiProperty({ example: "Article content...", nullable: true })
  fetchedContent: string | null;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z", nullable: true })
  fetchedAt: string | null;

  @ApiProperty({ example: "Summary of the article...", nullable: true })
  summary: string | null;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000", nullable: true })
  digestId: string | null;

  @ApiProperty({ nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: string;
}

export class ContentItemListResponseDto {
  @ApiProperty({ type: [ContentItemResponseDto] })
  items: ContentItemResponseDto[];

  @ApiProperty({ example: 10 })
  total: number;
}
