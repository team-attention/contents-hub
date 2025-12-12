import { type DbConnection, PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import { contentItems } from "@/db/schema";
import type { ContentItemStatus } from "@contents-hub/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import type {
  ContentItemListResponseDto,
  ContentItemResponseDto,
} from "./dto/content-item-response.dto";
import type { CreateContentItemDto } from "./dto/create-content-item.dto";
import type { UpdateContentItemDto } from "./dto/update-content-item.dto";

@Injectable()
export class ContentItemsService {
  constructor(
    @Inject(PROVIDER_DB_CONNECTION)
    private readonly db: DbConnection,
  ) {}

  async findAll(userId: string, status?: ContentItemStatus): Promise<ContentItemListResponseDto> {
    const whereClause = status
      ? and(eq(contentItems.userId, userId), eq(contentItems.status, status))
      : eq(contentItems.userId, userId);

    const [results, [{ total }]] = await Promise.all([
      this.db.select().from(contentItems).where(whereClause).orderBy(desc(contentItems.createdAt)),
      this.db.select({ total: count() }).from(contentItems).where(whereClause),
    ]);

    return {
      items: results.map(this.toResponseDto),
      total,
    };
  }

  async findById(userId: string, id: string): Promise<ContentItemResponseDto> {
    const [result] = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
      .limit(1);

    if (!result) {
      throw new NotFoundException("Content item not found");
    }

    return this.toResponseDto(result);
  }

  async findByUrl(userId: string, url: string): Promise<ContentItemResponseDto | null> {
    const [result] = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.userId, userId), eq(contentItems.url, url)))
      .limit(1);

    return result ? this.toResponseDto(result) : null;
  }

  async findPending(userId: string): Promise<ContentItemResponseDto[]> {
    const results = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.userId, userId), eq(contentItems.status, "pending")))
      .orderBy(desc(contentItems.createdAt));

    return results.map(this.toResponseDto);
  }

  async findReady(userId: string): Promise<ContentItemResponseDto[]> {
    const results = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.userId, userId), eq(contentItems.status, "ready")))
      .orderBy(desc(contentItems.createdAt));

    return results.map(this.toResponseDto);
  }

  async create(userId: string, dto: CreateContentItemDto): Promise<ContentItemResponseDto> {
    const [result] = await this.db
      .insert(contentItems)
      .values({
        userId,
        url: dto.url,
        title: dto.title,
        metadata: dto.metadata,
        status: "pending",
      })
      .returning();

    return this.toResponseDto(result);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateContentItemDto,
  ): Promise<ContentItemResponseDto> {
    const [existing] = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Content item not found");
    }

    const [result] = await this.db
      .update(contentItems)
      .set({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
      })
      .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
      .returning();

    return this.toResponseDto(result);
  }

  async updateStatus(
    userId: string,
    id: string,
    status: ContentItemStatus,
  ): Promise<ContentItemResponseDto> {
    return this.update(userId, id, { status });
  }

  async bulkUpdateStatus(
    userId: string,
    ids: string[],
    status: ContentItemStatus,
  ): Promise<number> {
    const result = await this.db
      .update(contentItems)
      .set({ status })
      .where(and(inArray(contentItems.id, ids), eq(contentItems.userId, userId)))
      .returning({ id: contentItems.id });

    return result.length;
  }

  async delete(userId: string, id: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Content item not found");
    }

    await this.db
      .delete(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)));
  }

  private toResponseDto(row: typeof contentItems.$inferSelect): ContentItemResponseDto {
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      status: row.status,
      source: row.source,
      subscriptionId: row.subscriptionId,
      fetchedContent: row.fetchedContent,
      fetchedAt: row.fetchedAt,
      summary: row.summary,
      digestId: row.digestId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
