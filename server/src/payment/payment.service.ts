import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY')!);
  }

  async createCheckoutSession(successUrl: string, cancelUrl: string) {
    const session = await this.stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Camera',
              description: 'DSLR camera',
            },
            unit_amount: 400000,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return session.url;
  }

  handleWebhook(request: any, sign: any) {
    try {

      const event = this.stripe.webhooks.constructEvent(
        request.body,
        sign,
        this.configService.get('STRIPE_WEBHOOK_ENDPOINT_SECRET')!
      );  

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(session.payment_intent);
        console.log('Payment done!');
      } else if(event.type === 'charge.refunded'){
        console.log("Money refunded")
      }

    } catch (error) {

      console.log(error)

    }
  }

  async handleRefund(paymentIntentId : string){
    await this.stripe.refunds.create({
      payment_intent : paymentIntentId
    })
    return {
      "message" : "Refund has been initiated!"
    }
  }
}
