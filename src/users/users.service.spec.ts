import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from 'src/jwt/jwt.service';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

const mockRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  findOneOrFail: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn(() => 'token-string'),
  verify: jest.fn(),
});

type MockRepository<T = any> = Partial<
  Record<keyof Repository<User>, jest.Mock>
>;
describe('UsersService', () => {
  let service: UsersService;
  let jwtService: JwtService;
  let usersRepository: MockRepository<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository(),
        },
        { provide: JwtService, useValue: mockJwtService() },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    usersRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAccount', () => {
    const createAccountArgs = {
      email: 'test@gmail.com',
      password: 'test',
      role: UserRole.Host,
    };
    it('should fail if user already exists', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 1,
        email: 'mock@gmail.com',
      });
      const result = await service.createAccount(createAccountArgs);
      expect(result).toMatchObject({
        ok: false,
        error: 'There is a user with that email already',
      });
    });
    it('should create a new user', async () => {
      usersRepository.findOne.mockResolvedValue(undefined);
      usersRepository.create.mockReturnValue(createAccountArgs);
      usersRepository.save.mockResolvedValue(createAccountArgs);

      const result = await service.createAccount(createAccountArgs);

      expect(usersRepository.create).toHaveBeenCalledTimes(1);
      expect(usersRepository.create).toHaveBeenCalledWith(createAccountArgs);

      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.save).toHaveBeenCalledWith(createAccountArgs);

      expect(result).toEqual({ ok: true });
    });
    it('should fail on exception', async () => {
      usersRepository.findOne.mockRejectedValue(new Error());
      const result = await service.createAccount(createAccountArgs);
      expect(result).toEqual({
        ok: false,
        error: 'Could not create account',
      });
    });
  });

  describe('login', () => {
    const loginArgs = {
      email: 'test@nnn.com',
      password: 'testpassword',
    };
    it("should fail if user doesn't exist", async () => {
      usersRepository.findOne.mockResolvedValue(undefined);
      const result = await service.login(loginArgs);
      expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOne).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
      );
      expect(result).toEqual({ ok: false, error: 'User not found' });
    });
    it('should fail if password is wrong', async () => {
      const mockedUser = {
        checkPassword: jest.fn(() => Promise.resolve(false)),
      };
      usersRepository.findOne.mockResolvedValue(mockedUser);

      const result = await service.login(loginArgs);
      expect(result).toEqual({ ok: false, error: 'Wrong password' });
    });
    it('should return a token if password is correct', async () => {
      const mockedUser = {
        id: 1,
        checkPassword: jest.fn(() => Promise.resolve(true)),
      };
      usersRepository.findOne.mockResolvedValue(mockedUser);

      const result = await service.login(loginArgs);

      expect(jwtService.sign).toHaveBeenCalledTimes(1);
      expect(jwtService.sign).toHaveBeenCalledWith(expect.any(Number));
      expect(result).toEqual({ ok: true, token: 'token-string' });
    });
    it('should fail on exception', async () => {
      usersRepository.findOne.mockRejectedValue(new Error());
      const result = await service.login(loginArgs);
      expect(result).toEqual({
        ok: false,
        error: new Error(),
      });
    });
  });
  describe('findByID', () => {
    const findByIdArgs = {
      id: 1,
    };
    it('should fail if user is not found', async () => {
      usersRepository.findOneOrFail.mockRejectedValue(new Error());
      const result = await service.findById(1);

      expect(usersRepository.findOneOrFail).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOneOrFail).toHaveBeenCalledWith(findByIdArgs);
      expect(result).toEqual({ ok: false, error: 'User not found' });
    });
    it('should return user if exists', async () => {
      usersRepository.findOneOrFail.mockResolvedValue(findByIdArgs);
      const result = await service.findById(1);

      expect(usersRepository.findOneOrFail).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOneOrFail).toHaveBeenCalledWith(findByIdArgs);
      expect(result).toEqual({ ok: true, user: findByIdArgs });
    });
  });
  describe('editProfile', () => {
    const oldUserEmail = {
      email: 'old-email@nnnnn.com',
    };
    const editEmailArgs = {
      userId: 1,
      input: { email: 'new-email@nnnnn.com' },
    };
    const oldUserPassword = {
      password: 'old-password',
    };
    const editPasswordArgs = {
      userId: 1,
      input: { password: 'new-password' },
    };

    it('should change email', async () => {
      const newUser = {
        email: editEmailArgs.input.email,
      };
      usersRepository.findOne.mockResolvedValueOnce(oldUserEmail);
      usersRepository.findOne.mockResolvedValueOnce(undefined);

      const result = await service.editProfile(
        editEmailArgs.userId,
        editEmailArgs.input,
      );

      expect(usersRepository.findOne).toHaveBeenCalledTimes(2);
      expect(usersRepository.findOne.mock.calls).toEqual([
        [editEmailArgs.userId],
        [{ email: editEmailArgs.input.email }],
      ]);

      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual({ ok: true });
    });
    it('should fail if email is alreadly in use', async () => {
      usersRepository.findOne.mockResolvedValueOnce(oldUserEmail);
      usersRepository.findOne.mockResolvedValueOnce({
        email: editEmailArgs.input.email,
      });

      const result = await service.editProfile(
        editEmailArgs.userId,
        editEmailArgs.input,
      );
      expect(usersRepository.findOne).toHaveBeenCalledTimes(2);
      expect(usersRepository.findOne.mock.calls).toEqual([
        [editEmailArgs.userId],
        [{ email: editEmailArgs.input.email }],
      ]);
      expect(result).toEqual({
        ok: false,
        error: 'Email already in use',
      });
    });

    it('should change password', async () => {
      const newUser = {
        password: editPasswordArgs.input.password,
      };
      usersRepository.findOne.mockResolvedValue(oldUserPassword);

      const result = await service.editProfile(
        editPasswordArgs.userId,
        editPasswordArgs.input,
      );
      expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOne).toHaveBeenCalledWith(
        editPasswordArgs.userId,
      );
      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual({ ok: true });
    });
    it('should fail on exception', async () => {
      usersRepository.findOne.mockRejectedValue(new Error());
      const result = await service.editProfile(1, { email: 'jj' });
      expect(result).toEqual({
        ok: false,
        error: 'Could not update profile',
      });
    });
  });
});
