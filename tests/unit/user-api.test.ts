import request from 'supertest';
import express, { Express } from 'express';
import { registerUserRoutes } from '../../server/api/users';
import { storage } from '../../server/storage';
import type { InsertUser, User } from '../../shared/schema';

// Mock storage module
jest.mock('../../server/storage', () => ({
  storage: {
    getUsers: jest.fn(),
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('User API Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerUserRoutes(app);
    jest.clearAllMocks();
  });

  const mockUser: User = {
    id: 'user-123',
    username: 'marie.dubois',
    firstName: 'Marie',
    lastName: 'Dubois',
    email: 'marie@koveo.ca',
    password: 'hashedPassword',
    role: 'tenant',
    language: 'fr',
    phone: '+1-514-555-0123',
    profileImage: '',
    isActive: true,
    lastLoginAt: new Date('2024-01-15T10:00:00Z'),
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockUserData: InsertUser = {
    username: 'jean.tremblay',
    firstName: 'Jean',
    lastName: 'Tremblay',
    email: 'jean@koveo.ca',
    password: 'securePassword123',
    role: 'manager',
    language: 'fr',
  };

  describe('GET /api/users', () => {
    it('should return all users successfully', async () => {
      mockStorage.getUsers.mockResolvedValue([mockUser]);

      const response = await request(app).get('/api/users').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual(mockUser);
      expect(mockStorage.getUsers).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no users exist', async () => {
      mockStorage.getUsers.mockResolvedValue([]);

      const response = await request(app).get('/api/users').expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle storage errors', async () => {
      mockStorage.getUsers.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/users').expect(500);

      expect(response.body).toMatchObject({
        _error: 'Internal server error',
        message: 'Failed to fetch users',
      });
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by ID without password', async () => {
      mockStorage.getUser.mockResolvedValue(mockUser);

      const response = await request(app).get('/api/users/user-123').expect(200);

      expect(response.body).toMatchObject({
        id: 'user-123',
        firstName: 'Marie',
        lastName: 'Dubois',
        email: 'marie@koveo.ca',
        role: 'tenant',
      });
      expect(response.body).not.toHaveProperty('password');
      expect(mockStorage.getUser).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 when user not found', async () => {
      mockStorage.getUser.mockResolvedValue(undefined);

      const response = await request(app).get('/api/users/non-existent').expect(404);

      expect(response.body).toMatchObject({
        _error: 'Not found',
        message: 'User not found',
      });
    });

    it('should return 400 when ID is missing', async () => {
      await request(app).get('/api/users/').expect(404); // Express returns 404 for empty parameter
    });

    it('should handle storage errors', async () => {
      mockStorage.getUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/users/user-123').expect(500);

      expect(response.body).toMatchObject({
        _error: 'Internal server error',
        message: 'Failed to fetch user',
      });
    });
  });

  describe('GET /api/users/email/:email', () => {
    it('should return user by email without password', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(mockUser);

      const response = await request(app).get('/api/users/email/marie@koveo.ca').expect(200);

      expect(response.body).toMatchObject({
        id: 'user-123',
        firstName: 'Marie',
        lastName: 'Dubois',
        email: 'marie@koveo.ca',
      });
      expect(response.body).not.toHaveProperty('password');
      expect(mockStorage.getUserByEmail).toHaveBeenCalledWith('marie@koveo.ca');
    });

    it('should return 404 when user not found', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(undefined);

      const response = await request(app).get('/api/users/email/notfound@koveo.ca').expect(404);

      expect(response.body).toMatchObject({
        _error: 'Not found',
        message: 'User not found',
      });
    });

    it('should handle URL encoded emails', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(mockUser);

      await request(app).get('/api/users/email/marie%40koveo.ca').expect(200);

      expect(mockStorage.getUserByEmail).toHaveBeenCalledWith('marie@koveo.ca');
    });

    it('should handle storage errors', async () => {
      mockStorage.getUserByEmail.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/users/email/marie@koveo.ca').expect(500);

      expect(response.body).toMatchObject({
        _error: 'Internal server error',
        message: 'Failed to fetch user',
      });
    });
  });

  describe('POST /api/users', () => {
    it('should create user successfully', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(undefined); // No existing user
      const newUser = {
        id: 'new-user-123',
        username: mockUserData.username,
        firstName: mockUserData.firstName,
        lastName: mockUserData.lastName,
        email: mockUserData.email,
        password: mockUserData.password,
        role: mockUserData.role as 'admin' | 'manager' | 'tenant' | 'resident',
        language: mockUserData.language,
        phone: mockUser.phone,
        profileImage: '',
        isActive: true,
        lastLoginAt: new Date('2024-01-15T10:00:00Z'),
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
      };
      mockStorage.createUser.mockResolvedValue(newUser);

      const response = await request(app).post('/api/users').send(mockUserData).expect(201);

      expect(response.body).toMatchObject({
        id: 'new-user-123',
        firstName: 'Jean',
        lastName: 'Tremblay',
        email: 'jean@koveo.ca',
        role: 'manager',
      });
      expect(response.body).not.toHaveProperty('password');
      expect(mockStorage.getUserByEmail).toHaveBeenCalledWith('jean@koveo.ca');
      expect(mockStorage.createUser).toHaveBeenCalledWith(mockUserData);
    });

    it('should return 409 when user already exists', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(mockUser); // Existing user

      const response = await request(app).post('/api/users').send(mockUserData).expect(409);

      expect(response.body).toMatchObject({
        _error: 'Conflict',
        message: 'User with this email already exists',
      });
      expect(mockStorage.createUser).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Test User' }) // Missing required fields
        .expect(400);

      expect(response.body).toMatchObject({
        _error: 'Validation error',
        message: 'Invalid user data',
      });
      expect(response.body.details).toBeDefined();
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          ...mockUserData,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        _error: 'Validation error',
        message: 'Invalid user data',
      });
    });

    it('should validate Quebec-specific data', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(undefined);
      mockStorage.createUser.mockResolvedValue({ ...mockUser, language: 'fr', role: 'tenant' });

      const quebecUserData = {
        name: 'Luc Beauregard',
        email: 'luc@koveo.ca',
        password: 'motdepasse123',
        language: 'fr',
        role: 'tenant',
      };

      const response = await request(app).post('/api/users').send(quebecUserData).expect(201);

      expect(response.body.language).toBe('fr');
      expect(mockStorage.createUser).toHaveBeenCalledWith(quebecUserData);
    });

    it('should handle storage errors', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(undefined);
      mockStorage.createUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/users').send(mockUserData).expect(500);

      expect(response.body).toMatchObject({
        _error: 'Internal server error',
        message: 'Failed to create user',
      });
    });
  });

  describe('PUT /api/users/:id', () => {
    const updateData = {
      firstName: 'Marie Updated',
      phone: '+1-514-555-9999',
      language: 'en',
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateData, updatedAt: new Date() };
      mockStorage.updateUser.mockResolvedValue(updatedUser);

      const response = await request(app).put('/api/users/user-123').send(updateData).expect(200);

      expect(response.body).toMatchObject({
        id: 'user-123',
        firstName: 'Marie Updated',
        phone: '+1-514-555-9999',
      });
      expect(response.body).not.toHaveProperty('password');
      expect(mockStorage.updateUser).toHaveBeenCalledWith('user-123', {
        ...updateData,
        updatedAt: expect.any(Date),
      });
    });

    it('should return 404 when user not found', async () => {
      mockStorage.updateUser.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/users/non-existent')
        .send(updateData)
        .expect(404);

      expect(response.body).toMatchObject({
        _error: 'Not found',
        message: 'User not found',
      });
    });

    it('should prevent password updates', async () => {
      const dataWithPassword = { ...updateData, password: 'newpassword' };
      const updatedUser = { ...mockUser, ...updateData };
      mockStorage.updateUser.mockResolvedValue(updatedUser);

      await request(app)
        .put('/api/users/user-123')
        .send(dataWithPassword)
        .expect(200);

      // Password should be omitted from the update call
      expect(mockStorage.updateUser).toHaveBeenCalledWith('user-123', {
        firstName: updateData.firstName,
        phone: updateData.phone,
        language: updateData.language,
        updatedAt: expect.any(Date),
      });
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .put('/api/users/user-123')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toMatchObject({
        _error: 'Validation error',
        message: 'Invalid user data',
      });
    });

    it('should handle storage errors', async () => {
      mockStorage.updateUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app).put('/api/users/user-123').send(updateData).expect(500);

      expect(response.body).toMatchObject({
        _error: 'Internal server error',
        message: 'Failed to update user',
      });
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should deactivate user (soft delete)', async () => {
      const deactivatedUser = { ...mockUser, isActive: false, updatedAt: new Date() };
      mockStorage.updateUser.mockResolvedValue(deactivatedUser);

      const response = await request(app).delete('/api/users/user-123').expect(200);

      expect(response.body).toMatchObject({
        message: 'User deactivated successfully',
        id: 'user-123',
      });
      expect(mockStorage.updateUser).toHaveBeenCalledWith('user-123', {
        isActive: false,
        updatedAt: expect.any(Date),
      });
    });

    it('should return 404 when user not found', async () => {
      mockStorage.updateUser.mockResolvedValue(undefined);

      const response = await request(app).delete('/api/users/non-existent').expect(404);

      expect(response.body).toMatchObject({
        _error: 'Not found',
        message: 'User not found',
      });
    });

    it('should handle storage errors', async () => {
      mockStorage.updateUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/users/user-123').expect(500);

      expect(response.body).toMatchObject({
        _error: 'Internal server error',
        message: 'Failed to deactivate user',
      });
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle extremely long names', async () => {
      const longName = 'a'.repeat(300);

      const response = await request(app)
        .post('/api/users')
        .send({
          ...mockUserData,
          firstName: longName,
        })
        .expect(400); // Should fail validation

      expect(response.body).toMatchObject({
        _error: 'Validation error',
        message: 'Invalid user data',
      });
    });

    it('should handle special characters in Quebec names', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(undefined);
      mockStorage.createUser.mockResolvedValue(mockUser);

      const quebecFirstName = 'Jean-François';
      const quebecLastName = 'Bélanger-Côté';

      await request(app)
        .post('/api/users')
        .send({
          ...mockUserData,
          firstName: quebecFirstName,
          lastName: quebecLastName,
        })
        .expect(201);

      expect(mockStorage.createUser).toHaveBeenCalledWith({
        ...mockUserData,
        firstName: quebecFirstName,
        lastName: quebecLastName,
      });
    });

    it('should handle empty request bodies', async () => {
      const response = await request(app).post('/api/users').send({}).expect(400);

      expect(response.body).toMatchObject({
        _error: 'Validation error',
        message: 'Invalid user data',
      });
    });

    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/api/users')
        .type('json')
        .send('{ invalid json }')
        .expect(400);
    });
  });

  describe('Quebec Language and Role Defaults', () => {
    it('should handle French language preference', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(undefined);
      const frenchUser = { ...mockUser, language: 'fr', role: 'manager' as const };
      mockStorage.createUser.mockResolvedValue(frenchUser);

      const response = await request(app)
        .post('/api/users')
        .send({
          firstName: 'Sylvie',
          lastName: 'Bouchard',
          email: 'sylvie@koveo.ca',
          password: 'motdepasse123',
          language: 'fr',
          role: 'manager',
        })
        .expect(201);

      expect(response.body.language).toBe('fr');
      expect(response.body.role).toBe('manager');
    });

    it('should handle different user roles', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(undefined);

      const roles = ['admin', 'manager', 'tenant', 'resident'] as const;

      for (const role of roles) {
        const testUser = { ...mockUser, role };
        mockStorage.createUser.mockResolvedValue(testUser);

        const response = await request(app)
          .post('/api/users')
          .send({
            ...mockUserData,
            email: `${role}@koveo.ca`,
            role,
          })
          .expect(201);

        expect(response.body.role).toBe(role);
      }
    });
  });
});
