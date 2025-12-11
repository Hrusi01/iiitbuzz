import { DrizzleClient as db } from '@/db/index';
import { posts as postsTable } from '@/db/schema/post.schema';
import { votes as votesTable } from '@/db/schema/votes.schema';
import { sql, eq } from 'drizzle-orm';
import { VotePayloadInput } from '@/dto/votes.dto';

export async function handlePostVote(
    postId: string,
    userId: string,
    voteValue: VotePayloadInput['voteValue']
) {
    return db.transaction(async (tx) => {
        //Find the existing votes
        const existingVote = await tx.select().from(votesTable)
            .where(sql`${votesTable.postId} = ${postId} AND ${votesTable.userId} = ${userId}`)
            .limit(1);

        const oldVoteValue = existingVote[0]?.value || 0;
        
        
        //Changing upvote (1) to downvote (-1) results in a delta of -2 (-1 - 1)
        const delta = voteValue - oldVoteValue;
        if (voteValue === 0) {
           //delete if 0
            await tx.delete(votesTable)
                .where(sql`${votesTable.postId} = ${postId} AND ${votesTable.userId} = ${userId}`);
        } else {
            //insert new vote 
            await tx.insert(votesTable)
                .values({ postId: postId, userId: userId, value: voteValue })
                .onConflictDoUpdate({
                    target: [votesTable.userId, votesTable.postId],
                    set: { value: voteValue },
                });
        }

        // update total post in post table
        const [updatedPost] = await tx.update(postsTable)
            .set({ 
                vote: sql`${postsTable.vote} + ${delta}`,
            })
            .where(eq(postsTable.id, postId))
            .returning();
            
        if (!updatedPost) {
            //roll back if no transaction
            tx.rollback();
            throw new Error('Post not found or failed to update vote count.');
        }

        return updatedPost;
    });
}