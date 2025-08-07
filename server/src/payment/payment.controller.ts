import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Head, Headers } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('stripe')
export class PaymentController {

  constructor(
    private readonly paymentService: PaymentService,
  ) {}

  @Get("create-checkout-session")
  handleCreatePaymentSession(){
    return this.paymentService.createCheckoutSession(
      "http://localhost:3000/stripe/success",
      "http://localhost:3000/stripe/cancel"
    );
  }

  @Get("success")
  handlePaymentSucess(){
    return "Thank you for placing order..."
  }

  @Get("cancel")
  handlePaymentCancel(){
    return "Forgot to add something in cart? Add and come back to place order..."
  }

  @Post("webhook")
  handleStripeWebhook(@Req() request,@Headers('stripe-signature') sign){
    this.paymentService.handleWebhook(request,sign);
  }

  @Delete("refund/:intentId")
  handleRefund(@Param('intentId') intentId : string){
    this.paymentService.handleRefund(intentId);
  }
  
}
