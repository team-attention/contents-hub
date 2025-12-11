---
when:
  - 새로운 테이블/컬럼 추가 시
  - 스키마 설계 리뷰 시
  - 데이터 중복 저장 여부 판단 시

what: |
  데이터베이스 스키마 규칙. 데이터 이원화 방지 및 JOIN 활용 원칙.
---

# 데이터베이스 스키마 규칙

## Rule

JOIN으로 계산 가능한 필드는 별도 컬럼으로 저장하지 않는다.

## Why

- 데이터 이원화(파편화) 방지
- 일관성 유지 (single source of truth)
- 동기화 버그 제거

## Example

### ❌ Bad - 중복 저장

```typescript
// content_items 테이블에 errorCount 저장
content_items: {
  id, url, status,
  errorCount: integer  // fetch_history에서 계산 가능
}
```

### ✅ Good - JOIN으로 계산

```sql
SELECT ci.*, COUNT(fh.id) as error_count
FROM content_items ci
LEFT JOIN fetch_history fh ON fh.content_item_id = ci.id
WHERE fh.status = 'error'
GROUP BY ci.id
```

## 예외

- 성능상 필수인 경우 (수백만 row JOIN 비용)
- 이 경우에도 트리거/애플리케이션 레벨 동기화 필수
