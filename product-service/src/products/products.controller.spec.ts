import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ClientProxy } from '@nestjs/microservices';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<ProductsService>;
  let stockUpdateBus: jest.Mocked<ClientProxy>;

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
        {
          provide: 'STOCK_UPDATE_BUS',
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get(ProductsService);
    stockUpdateBus = module.get('STOCK_UPDATE_BUS');
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create', async () => {
      const dto = { name: 'New Product', qty: 10, price: 100 } as any;
      const mockResult = { id: 1, ...dto };
      service.create.mockResolvedValue(mockResult);

      const result = await controller.create(dto, {} as any);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne', async () => {
      const product = { id: 1, name: 'Test Product' } as any;
      service.findOne.mockResolvedValue(product);

      const result = await controller.findOne(1, {} as any);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(product);
    });
  });

  describe('handleOrderCreated', () => {
    it('should buffer qty correctly', async () => {
      const payload = { productId: 1, qty: 5 };
      await controller.handleOrderCreated(payload);

      expect(controller['stockUpdateBuffer'].get(1)).toEqual(5);
    });

    it('should accumulate qty for same product', async () => {
      controller['stockUpdateBuffer'].set(1, 3);
      const payload = { productId: 1, qty: 2 };
      await controller.handleOrderCreated(payload);

      expect(controller['stockUpdateBuffer'].get(1)).toEqual(5);
    });
  });

  describe('handleStockUpdateBatch', () => {
    it('should emit stock_update_task for buffered products', async () => {
      controller['stockUpdateBuffer'].set(1, 5);
      await controller.handleStockUpdateBatch();

      expect(stockUpdateBus.emit).toHaveBeenCalledWith('stock_update_task', { productId: 1, quantity: 5 });
      expect(controller['stockUpdateBuffer'].size).toBe(0);
    });
  });

  describe('handleStockUpdateTask', () => {
    it('should call reduceStock', async () => {
      const task = { productId: 1, quantity: 2 };
      await controller.handleStockUpdateTask(task);
      expect(service.reduceStock).toHaveBeenCalledWith(1, 2);
    });
  });
});
