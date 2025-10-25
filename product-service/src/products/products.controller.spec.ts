import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dtos/create-product.dto';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<ProductsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            reduceStock: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call ProductsService.create with correct dto', async () => {
      const dto: CreateProductDto = { name: 'Test Product', price: 100, qty: 5 };
      const result = { id: 1, ...dto };
      service.create.mockResolvedValue(result as any);

      const response = await controller.create(dto, {} as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(response).toEqual(result);
    });
  });

  describe('findOne', () => {
    it('should call ProductsService.findOne with id as number', async () => {
      const product = { id: 1, name: 'Product', price: 100, qty: 5 };
      service.findOne.mockResolvedValue(product as any);

      const response = await controller.findOne(1 as any, {} as any);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(response).toEqual(product);
    });
  });

  describe('handleOrderCreated', () => {
    it('should call ProductsService.reduceStock with correct params', async () => {
      const payload = { productId: 10, qty: 3 };

      await controller.handleOrderCreated(payload);

      expect(service.reduceStock).toHaveBeenCalledWith(10, 3);
    });
  });
});
