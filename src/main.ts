import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AdminService } from './admin/admin.service';
import { ErrorModuleService } from './error_module/error_module.service';
import { AllExceptionsFilter } from './common/filters/error.filter';

async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // setup errorFilter
  const errorLogService = app.get(ErrorModuleService);
  app.useGlobalFilters(new AllExceptionsFilter(errorLogService));

  // setup validation pipeline
  app.useGlobalPipes(new ValidationPipe());

  // setup static folder path
  app.useStaticAssets(join(__dirname, '..', 'uploads'));

  // seeding super admin data
  app.get(AdminService).seedSuperAdminData();

  // swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('User Management APIs')
    .setDescription('This is user management APIs with authetication!')
    .setVersion('1.0')
    .addBearerAuth()  
    .build();

  // setup swagger document
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);

}

bootstrap();