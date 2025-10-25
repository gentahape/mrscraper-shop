import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ResponseMessage } from '../common/response-message.decorator';
import { CreateProductDto } from './dtos/create-product.dto';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

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
    await this.productsService.reduceStock(payload.productId, payload.qty);
  }
}
