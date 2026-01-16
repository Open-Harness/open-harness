/**
 * Post interface defining the structure for blog post objects.
 * This interface serves as the foundation for all post-related operations.
 */
export interface Post {
  /** Unique identifier for the post */
  id: string;

  /** Title of the blog post */
  title: string;

  /** Main content/body of the blog post */
  content: string;

  /** Unique identifier of the user who authored the post */
  authorId: string;

  /** Timestamp when the post was created */
  createdAt: Date;
}