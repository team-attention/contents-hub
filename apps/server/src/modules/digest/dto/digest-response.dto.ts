import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DigestResponseDto {
  @ApiProperty({ description: "Digest ID" })
  id!: string;

  @ApiProperty({ description: "User ID" })
  userId!: string;

  @ApiProperty({ description: "Digest title" })
  title!: string;

  @ApiProperty({ description: "Digest content" })
  content!: string;

  @ApiProperty({ description: "Number of items in the digest" })
  itemCount!: number;

  @ApiProperty({ description: "Total input tokens used" })
  totalInputTokens!: number;

  @ApiProperty({ description: "Total output tokens used" })
  totalOutputTokens!: number;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt!: string;
}

export class DigestListResponseDto {
  @ApiProperty({ type: [DigestResponseDto] })
  items!: DigestResponseDto[];

  @ApiProperty({ description: "Total count" })
  total!: number;
}

export class TriggerDigestResponseDto {
  @ApiProperty({ description: "Operation success status" })
  success!: boolean;

  @ApiPropertyOptional({ description: "Created digest" })
  digest?: DigestResponseDto;

  @ApiProperty({ description: "Number of items fetched" })
  fetchedCount!: number;

  @ApiProperty({ description: "Number of items summarized" })
  summarizedCount!: number;

  @ApiPropertyOptional({ description: "Message" })
  message?: string;
}
