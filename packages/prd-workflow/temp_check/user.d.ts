/**
 * User interface defining the structure for user objects in the authentication system.
 * This interface serves as the foundation for all user-related operations.
 */
export interface User {
    /** Unique identifier for the user */
    id: string;
    /** User's email address */
    email: string;
    /** Hashed password for secure storage */
    passwordHash: string;
    /** Timestamp when the user account was created */
    createdAt: Date;
}
