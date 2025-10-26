import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './products.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Repository, MoreThanOrEqual } from 'typeorm';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<Repository<Product>>;
  let cacheManager: any;
  let productBus: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOneBy: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: 'PRODUCT_BUS',
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repository = module.get(getRepositoryToken(Product));
    cacheManager = module.get(CACHE_MANAGER);
    productBus = module.get('PRODUCT_BUS');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and emit product_created', async () => {
      const dto = { name: 'Test Product', qty: 10, price: 1000 } as any;
      const savedProduct = { id: 1, ...dto };

      repository.create.mockReturnValue(savedProduct);
      repository.save.mockResolvedValue(savedProduct);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining(dto));
      expect(repository.save).toHaveBeenCalledWith(savedProduct);
      expect(productBus.emit).toHaveBeenCalledWith('product_created', savedProduct);
      expect(result).toEqual(savedProduct);
    });
  });

  describe('findOne', () => {
    it('should return cached product if available', async () => {
      const cachedProduct = { id: 1, name: 'Cached Product' } as Product;
      cacheManager.get.mockResolvedValue(cachedProduct);

      const result = await service.findOne(1);

      expect(cacheManager.get).toHaveBeenCalledWith('product:1');
      expect(repository.findOneBy).not.toHaveBeenCalled();
      expect(result).toEqual(cachedProduct);
    });

    it('should fetch from DB and cache it if not cached', async () => {
      const dbProduct = { id: 1, name: 'From DB' } as Product;
      cacheManager.get.mockResolvedValue(null);
      repository.findOneBy.mockResolvedValue(dbProduct);

      const result = await service.findOne(1);

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(cacheManager.set).toHaveBeenCalledWith('product:1', dbProduct, 300 * 1000);
      expect(result).toEqual(dbProduct);
    });

    it('should throw NotFoundException if product not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reduceStock', () => {
    it('should call repository.update with correct parameters', async () => {
      await service.reduceStock(1, 5);
      expect(repository.update).toHaveBeenCalledWith(
        { id: 1, qty: MoreThanOrEqual(5) },
        { qty: expect.any(Function) }
      );
    });
  });
});
