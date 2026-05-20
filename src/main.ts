import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Requis pour Better Auth (la lib re-applique pour les autres routes)
  });

  // CORS avec credentials (cookies)
  app.enableCors({
    origin: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
    credentials: true,
  });

  // Validation globale des DTOs (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ignore les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // 400 si un champ non déclaré est envoyé
      transform: true, // applique class-transformer
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();