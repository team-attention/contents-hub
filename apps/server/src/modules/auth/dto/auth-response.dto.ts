import { ApiProperty } from "@nestjs/swagger";

export class GetMeResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  id: string;

  @ApiProperty({ example: "user@example.com", nullable: true })
  email?: string;
}

export class GetMyIdResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  userId: string;
}
