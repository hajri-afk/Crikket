import { relations } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { organization, user } from "./auth"

/**
 * A room groups bug reports of a single project/testing surface inside an
 * organization. Bug reports reference a room, not the other way around, so this
 * module intentionally does not import ./bug-report (keeps the schema graph
 * acyclic). The `bugReport.room` side of the relation lives in ./bug-report.
 */
export const room = pgTable(
  "room",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    color: text("color").default("slate").notNull(),
    status: text("status").default("active").notNull(), // active | archived
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("room_organizationId_idx").on(table.organizationId),
    index("room_status_idx").on(table.status),
    uniqueIndex("room_organizationId_slug_idx").on(
      table.organizationId,
      table.slug
    ),
  ]
)

export const roomRelations = relations(room, ({ one }) => ({
  organization: one(organization, {
    fields: [room.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [room.createdBy],
    references: [user.id],
  }),
}))
