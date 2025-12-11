import { pgTable, uuid, smallint, uniqueIndex } from "drizzle-orm/pg-core";
import { posts } from "./post.schema"; 
import { users } from "./user.schema"; 

export const votes = pgTable(
    "vote",
    {
        //composite Key:userId, postId
        userId: uuid("user_id")
            .references(() => users.id, { onDelete: "restrict" })
            .notNull(),
            
        postId: uuid("post_id")
            .references(() => posts.id, { onDelete: "cascade" })
            .notNull(),

        //1 for upvote, -1 for downvote
        value: smallint("value").notNull(),
        
        
    },
    (table) => ({
        pk: uniqueIndex("vote_pk").on(table.userId, table.postId), 
    })
);