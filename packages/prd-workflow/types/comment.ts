/**
 * Comment interface defining the structure for blog comment objects.
 * This interface serves as the foundation for all comment-related operations.
 */
export interface Comment {
  /** Unique identifier for the comment */
  id: string;

  /** Unique identifier of the post this comment belongs to */
  postId: string;

  /** Text content of the comment */
  content: string;

  /** Unique identifier of the user who authored the comment */
  authorId: string;

  /** Timestamp when the comment was created */
  createdAt: Date;
}