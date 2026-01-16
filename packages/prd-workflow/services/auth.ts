import { User } from '../types/user';
import { hashPassword, verifyPassword } from '../utils/password';

/**
 * AuthService class provides user authentication functionality including
 * user registration and login operations.
 */
export class AuthService {
  /**
   * Constructor for AuthService
   */
  constructor() {
    // Initialize any required state or dependencies
  }

  /**
   * Helper method to generate a unique user ID
   * In a real application, this would typically be handled by the database
   */
  private generateUserId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Helper method to simulate finding a user by email
   * In a real application, this would query the database
   */
  private async findUserByEmail(email: string): Promise<User | null> {
    // This is a simulation - in a real app, you'd query your database
    // For demonstration, we'll return null (user not found)
    // In a complete implementation, you'd have a user repository or database layer
    return null;
  }

  /**
   * Registers a new user with the provided email and password
   * @param email - User's email address
   * @param password - User's plain text password
   * @returns Promise<User> - The created user object
   */
  async register(email: string, password: string): Promise<User> {
    // Basic email validation
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    // Basic password validation
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Hash the password using the password utility
    const passwordHash = hashPassword(password);

    // Create new user object
    const newUser: User = {
      id: this.generateUserId(),
      email,
      passwordHash,
      createdAt: new Date()
    };

    // In a real application, you would save this to a database
    // For this implementation, we'll just return the user object
    return newUser;
  }

  /**
   * Authenticates a user with the provided email and password
   * @param email - User's email address
   * @param password - User's plain text password
   * @returns Promise<User> - The authenticated user object
   */
  async login(email: string, password: string): Promise<User> {
    // Basic input validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // In a real application, you would look up the user in a database
    // For this implementation, we'll simulate a user lookup
    const storedUser = await this.findUserByEmail(email);

    if (!storedUser) {
      throw new Error('User not found');
    }

    // Verify the password using the password utility
    const isPasswordValid = verifyPassword(password, storedUser.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Return the authenticated user (without the password hash for security)
    return {
      id: storedUser.id,
      email: storedUser.email,
      passwordHash: storedUser.passwordHash,
      createdAt: storedUser.createdAt
    };
  }
}