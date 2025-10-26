import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

async function ensureExchangeBinding() {
  const conn = await amqp.connect(process.env.RABBITMQ_HOST);
  const ch = await conn.createChannel();

  await ch.assertExchange('orders_exchange', 'topic', { durable: true });
  await ch.assertQueue('product_events_queue', { durable: true });
  await ch.bindQueue('product_events_queue', 'orders_exchange', 'order_created');

  await ch.assertExchange('stock_exchange', 'topic', { durable: true });
  await ch.assertQueue('stock_update_queue', { durable: true });
  await ch.bindQueue('stock_update_queue', 'stock_exchange', 'stock_update_task');

  await ch.close();
  await conn.close();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const rabbitmqHost = configService.get('RABBITMQ_HOST');

  app.useGlobalPipes(new ValidationPipe())

  await ensureExchangeBinding();

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqHost],
      queue: 'product_events_queue',
      queueOptions: {
        durable: true
      },
      prefetchCount: 50,
    }
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqHost],
      queue: 'stock_update_queue',
      queueOptions: { 
        durable: true 
      },
      prefetchCount: 10 
    }
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
