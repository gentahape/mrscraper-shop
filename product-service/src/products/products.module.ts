import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './products.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'PRODUCT_BUS',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get('RABBITMQ_HOST')],
            exchange: 'orders_exchange',
            exchangeType: 'topic',
            queue: 'products_queue', 
            queueOptions: { 
              durable: true,
            }
          }
        })
      },
      {
        name: 'STOCK_UPDATE_BUS',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
            options: {
              urls: [configService.get('RABBITMQ_HOST')],
              exchange: 'stock_exchange',
              exchangeType: 'topic',
              queue: 'stock_update_queue',
              queueOptions: {
                durable: true,
              },
            }
        })
      }
    ])
  ],
  exports: [TypeOrmModule, ProductsService],
  controllers: [ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
