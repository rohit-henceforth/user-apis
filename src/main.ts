import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AdminService } from './admin/admin.service';

async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe());

  app.useStaticAssets(join(__dirname, '..', 'uploads'));

  // seeding super admin data
  app.get(AdminService).seedSuperAdminData();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('User Management APIs')
    .setDescription('This is user management APIs with authetication!')
    .setVersion('1.0')
    .addBearerAuth()  
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);

}

bootstrap();