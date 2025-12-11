import { type DbConnection, PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import { digests } from "@/db/schema";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { DigestListResponseDto, DigestResponseDto } from "./dto/digest-response.dto";

@Injectable()
export class DigestService {
  constructor(
    @Inject(PROVIDER_DB_CONNECTION)
    private readonly db: DbConnection,
  ) {}

  async findAll(userId: string): Promise<DigestListResponseDto> {
    const results = await this.db
      .select()
      .from(digests)
      .where(eq(digests.userId, userId))
      .orderBy(desc(digests.createdAt));

    return {
      items: results.map(this.toResponseDto),
      total: results.length,
    };
  }

  async findById(userId: string, id: string): Promise<DigestResponseDto> {
    const [result] = await this.db
      .select()
      .from(digests)
      .where(and(eq(digests.id, id), eq(digests.userId, userId)))
      .limit(1);

    if (!result) {
      throw new NotFoundException("Digest not found");
    }

    return this.toResponseDto(result);
  }

  async findToday(userId: string): Promise<DigestResponseDto | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [result] = await this.db
      .select()
      .from(digests)
      .where(
        and(
          eq(digests.userId, userId),
          gte(digests.createdAt, today.toISOString()),
          lt(digests.createdAt, tomorrow.toISOString()),
        ),
      )
      .orderBy(desc(digests.createdAt))
      .limit(1);

    return result ? this.toResponseDto(result) : null;
  }

  private toResponseDto(row: typeof digests.$inferSelect): DigestResponseDto {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      content: row.content,
      itemCount: row.itemCount,
      totalInputTokens: row.totalInputTokens,
      totalOutputTokens: row.totalOutputTokens,
      createdAt: row.createdAt,
    };
  }
}
