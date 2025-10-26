import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './products.entity';
import { CreateProductDto } from './dtos/create-product.dto';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';
import { ClientProxy } from '@nestjs/microservices';
import { MoreThanOrEqual } from 'typeorm';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>, 
    @Inject(CACHE_MANAGER) public readonly cacheManager: Cache,
    @Inject('PRODUCT_BUS') private readonly productBus: ClientProxy
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const newData = this.productsRepository.create({
      ...createProductDto,
      createdAt: new Date(),
    });
    const savedData = await this.productsRepository.save(newData);

    this.productBus.emit('product_created', newData);

    return savedData;
  }

  async findOne(id: number) {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.productsRepository.findOneBy({ id });
    if (!data) {
      throw new NotFoundException('Product not found');
    }
    
    await this.cacheManager.set(cacheKey, data, 300 * 1000);
    return data as Product;
  }

  async reduceStock(id: number, qty: number) {
    await this.productsRepository.update(
      { 
        id: id, 
        qty: MoreThanOrEqual(qty)
      },
      { 
        qty: () => `qty - ${qty}`
      }
    );
  }
}
