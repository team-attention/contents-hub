import { type DbConnection, PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import { subscriptions } from "@/db/schema";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import type {
  SubscriptionListResponseDto,
  SubscriptionResponseDto,
} from "./dto/subscription-response.dto";

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(PROVIDER_DB_CONNECTION)
    private readonly db: DbConnection,
  ) {}

  async findAll(userId: string): Promise<SubscriptionListResponseDto> {
    const results = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));

    return { items: results.map(this.toResponseDto) };
  }

  async findByUrl(userId: string, url: string): Promise<SubscriptionResponseDto | null> {
    const [result] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.url, url)))
      .limit(1);

    return result ? this.toResponseDto(result) : null;
  }

  async create(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    const [result] = await this.db
      .insert(subscriptions)
      .values({
        userId,
        url: dto.url,
        name: dto.name,
        checkInterval: dto.checkInterval ?? 60,
        status: "active",
      })
      .returning();

    return this.toResponseDto(result);
  }

  async delete(userId: string, id: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Subscription not found");
    }

    await this.db
      .delete(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
  }

  private toResponseDto(row: typeof subscriptions.$inferSelect): SubscriptionResponseDto {
    return {
      id: row.id,
      url: row.url,
      name: row.name,
      status: row.status,
      checkInterval: row.checkInterval,
      lastCheckedAt: row.lastCheckedAt,
      lastContentHash: row.lastContentHash,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
