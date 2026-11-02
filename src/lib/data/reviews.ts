import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";

export type PublicReview = {
  id: string;
  rating: number;
  text: string;
  author_name: string;
  owner_reply: string | null;
  owner_reply_at: string | null;
  created_at: string;
};

// Одобренные отзывы карточки (сбрасывается тегом listings при модерации и ответе владельца).
export async function getListingReviews(listingId: string): Promise<PublicReview[]> {
  "use cache";
  cacheTag("listings");
  cacheLife("hours");
  const { data, error } = await createPublicClient().rpc("listing_reviews", { p_listing: listingId });
  if (error) {
    console.error("listing_reviews", error.message);
    return [];
  }
  return (data ?? []) as PublicReview[];
}
