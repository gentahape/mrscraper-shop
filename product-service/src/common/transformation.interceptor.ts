import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { map, Observable } from "rxjs"
import { RESPONSE_MESSAGE_KEY } from "./response-message.decorator"

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  errors: any;
}

@Injectable()
export class TransformationInterceptor<T> implements NestInterceptor<T, Response<T>> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const responseMessage = this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler()) || 'success';

    return next.handle().pipe(
      map((data) => {
        return {
          success: true,
          message: responseMessage,
          data,
          errors: null
        } as Response<T>;
      })
    );
    
  }
}