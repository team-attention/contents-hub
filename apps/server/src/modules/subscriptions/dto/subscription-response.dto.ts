import { ApiProperty } from "@nestjs/swagger";

export class SubscriptionResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  id: string;

  @ApiProperty({ example: "https://example.com/page" })
  url: string;

  @ApiProperty({ example: "My Subscription" })
  name: string;

  @ApiProperty({ enum: ["active", "paused", "error"], example: "active" })
  status: string;

  @ApiProperty({ example: 3600, description: "Check interval in seconds" })
  checkInterval: number;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z", nullable: true })
  lastCheckedAt: string | null;

  @ApiProperty({ example: "abc123hash", nullable: true })
  lastContentHash: string | null;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: string;
}

export class SubscriptionListResponseDto {
  @ApiProperty({ type: [SubscriptionResponseDto] })
  items: SubscriptionResponseDto[];
}
