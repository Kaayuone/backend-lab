import { Test } from '@nestjs/testing';
import { requireTestDatabaseUrl } from './test-env.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

export async function createTestApp() {
  process.env.DATABASE_URL = requireTestDatabaseUrl();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}
