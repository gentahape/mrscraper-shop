import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './products.entity';
import { ClientProxy } from '@nestjs/microservices';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dtos/create-product.dto';

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: jest.Mocked<Repository<Product>>;
  let cache: jest.Mocked<Cache>;
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
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
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
    repo = module.get(getRepositoryToken(Product));
    cache = module.get(CACHE_MANAGER);
    productBus = module.get('PRODUCT_BUS');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and save a product, then emit an event', async () => {
      const dto: CreateProductDto = { name: 'Test', price: 100, qty: 10 };
      const created = { ...dto, id: 1, createdAt: new Date() } as Product;

      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining(dto));
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(productBus.emit).toHaveBeenCalledWith('product_created', created);
      expect(result).toEqual(created);
    });
  });


  describe('findOne', () => {
    it('should return cached product if available', async () => {
      const cachedProduct = { id: 1, name: 'Cached', price: 100, qty: 5 } as Product;
      cache.get.mockResolvedValue(cachedProduct);

      const result = await service.findOne(1);

      expect(cache.get).toHaveBeenCalledWith('product:1');
      expect(repo.findOneBy).not.toHaveBeenCalled();
      expect(result).toEqual(cachedProduct);
    });

    it('should fetch from DB if not in cache and then cache it', async () => {
      const dbProduct = { id: 1, name: 'DB Product', price: 500, qty: 10 } as Product;
      cache.get.mockResolvedValue(undefined);
      repo.findOneBy.mockResolvedValue(dbProduct);

      const result = await service.findOne(1);

      expect(cache.get).toHaveBeenCalledWith('product:1');
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(cache.set).toHaveBeenCalledWith('product:1', dbProduct);
      expect(result).toEqual(dbProduct);
    });

    it('should throw NotFoundException if product not found', async () => {
      cache.get.mockResolvedValue(undefined);
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reduceStock', () => {
    it('should reduce stock, save product, and delete cache', async () => {
      const product = { id: 1, qty: 10 } as Product;
      jest.spyOn(service, 'findOne').mockResolvedValue(product);

      await service.reduceStock(1, 3);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(repo.save).toHaveBeenCalledWith({ id: 1, qty: 7 });
      expect(cache.del).toHaveBeenCalledWith('product:1');
    });

    it('should throw BadRequestException if stock not enough', async () => {
      const product = { id: 1, qty: 2 } as Product;
      jest.spyOn(service, 'findOne').mockResolvedValue(product);

      await expect(service.reduceStock(1, 5)).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
