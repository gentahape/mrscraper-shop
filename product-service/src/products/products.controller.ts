import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ResponseMessage } from '../common/response-message.decorator';
import { CreateProductDto } from './dtos/create-product.dto';
import { ClientProxy, EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { Interval } from '@nestjs/schedule';

@Controller('products')
export class ProductsController {
  private stockUpdateBuffer = new Map<number, number>();

  constructor(
    private readonly productsService: ProductsService,
    @Inject('STOCK_UPDATE_BUS') private readonly stockUpdateBus: ClientProxy
  ) {}

  @Post()
  @ResponseMessage('Product has been created')
  create(@Body() createProductDto: CreateProductDto, @Req() req: Request) {
    return this.productsService.create(createProductDto)
  }

  @Get(':id')
  @ResponseMessage('Product has been founded')
  findOne(@Param('id') id: number, @Req() req: Request) {
    return this.productsService.findOne(id)
  }

  @EventPattern('order_created')
  async handleOrderCreated(@Payload() payload: { productId: number, qty: number }) {
    const { productId, qty } = payload;
    if (!productId || !qty) return

    const currentReduction = this.stockUpdateBuffer.get(productId) || 0;
    this.stockUpdateBuffer.set(productId, currentReduction + qty);
  }

  @Interval(1000) 
  async handleStockUpdateBatch() {
    if (this.stockUpdateBuffer.size === 0) {
      return;
    }

    const bufferToProcess = new Map(this.stockUpdateBuffer);
    this.stockUpdateBuffer.clear();

    for (const [productId, quantity] of bufferToProcess.entries()) {
      const stockUpdatePayload = { productId, quantity };
      this.stockUpdateBus.emit('stock_update_task', stockUpdatePayload);
    }
  }

  @MessagePattern('stock_update_task')
  async handleStockUpdateTask(@Payload() task: { productId: number, quantity: number }) {
    const { productId, quantity } = task;
    await this.productsService.reduceStock(productId, quantity);
  }
}
