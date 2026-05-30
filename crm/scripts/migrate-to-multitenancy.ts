/**
 * Migration Script: Convert existing CRM data to multi-tenancy
 *
 * This script:
 * 1. Creates a SysAdmin user
 * 2. Creates default subscription plans
 * 3. Creates a default tenant for existing data
 * 4. Creates a free subscription for the default tenant
 * 5. Updates all existing records with the default tenantId
 *
 * Usage: npx tsx scripts/migrate-to-multitenancy.ts
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;

interface MigrationConfig {
  sysAdmin: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
  defaultTenant: {
    name: string;
    slug: string;
  };
}

const config: MigrationConfig = {
  sysAdmin: {
    email: process.env.SYSADMIN_EMAIL || 'admin@iot-crm.local',
    password: process.env.SYSADMIN_PASSWORD || 'ChangeMe123!',
    firstName: 'System',
    lastName: 'Administrator',
  },
  defaultTenant: {
    name: 'Default Tenant',
    slug: 'default',
  },
};

async function createPlans() {
  console.log('Creating subscription plans...');

  const plans = [
    {
      id: randomUUID(),
      name: 'Starter',
      code: 'starter',
      description: 'Perfect for small teams getting started with IoT',
      monthlyPrice: 29,
      yearlyPrice: 290,
      currency: 'USD',
      maxUsers: 5,
      maxDevices: 20,
      maxAssets: 50,
      maxStorageGb: 5,
      features: ['Basic dashboard', 'Email support', 'API access'],
      featureFlags: { aiChat: false, customBranding: false },
      isActive: true,
      isPublic: true,
      sortOrder: 1,
    },
    {
      id: randomUUID(),
      name: 'Professional',
      code: 'professional',
      description: 'For growing businesses with advanced needs',
      monthlyPrice: 99,
      yearlyPrice: 990,
      currency: 'USD',
      maxUsers: 25,
      maxDevices: 100,
      maxAssets: 250,
      maxStorageGb: 25,
      features: [
        'Advanced dashboard',
        'Priority support',
        'API access',
        'AI Chat assistant',
        'Contract management',
        'Custom reports',
      ],
      featureFlags: { aiChat: true, customBranding: false, advancedReports: true },
      isActive: true,
      isPublic: true,
      sortOrder: 2,
    },
    {
      id: randomUUID(),
      name: 'Enterprise',
      code: 'enterprise',
      description: 'Unlimited scale with premium features',
      monthlyPrice: 299,
      yearlyPrice: 2990,
      currency: 'USD',
      maxUsers: null, // Unlimited
      maxDevices: null,
      maxAssets: null,
      maxStorageGb: 100,
      features: [
        'All Professional features',
        'Unlimited users',
        'Unlimited devices',
        'Custom branding',
        'Dedicated support',
        'SLA guarantee',
        'Custom integrations',
        'On-premise option',
      ],
      featureFlags: { aiChat: true, customBranding: true, advancedReports: true, sla: true },
      isActive: true,
      isPublic: true,
      sortOrder: 3,
    },
    {
      id: randomUUID(),
      name: 'Free',
      code: 'free',
      description: 'Free tier for evaluation and small projects',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'USD',
      maxUsers: 2,
      maxDevices: 5,
      maxAssets: 10,
      maxStorageGb: 1,
      features: ['Basic dashboard', 'Community support'],
      featureFlags: { aiChat: false, customBranding: false },
      isActive: true,
      isPublic: false, // Not shown on pricing page, but available
      sortOrder: 0,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
    console.log(`  Created/updated plan: ${plan.name}`);
  }

  return plans;
}

async function createSysAdmin() {
  console.log('Creating SysAdmin user...');

  const existingSysAdmin = await prisma.user.findFirst({
    where: { role: 'sys_admin' },
  });

  if (existingSysAdmin) {
    console.log(`  SysAdmin already exists: ${existingSysAdmin.email}`);
    return existingSysAdmin;
  }

  const passwordHash = await bcrypt.hash(config.sysAdmin.password, SALT_ROUNDS);

  const sysAdmin = await prisma.user.create({
    data: {
      email: config.sysAdmin.email,
      passwordHash,
      firstName: config.sysAdmin.firstName,
      lastName: config.sysAdmin.lastName,
      role: 'sys_admin',
      status: 'active',
      emailVerified: true,
    },
  });

  console.log(`  Created SysAdmin: ${sysAdmin.email}`);
  console.log(`  Password: ${config.sysAdmin.password} (CHANGE THIS!)`);

  return sysAdmin;
}

async function createDefaultTenant(plans: any[]) {
  console.log('Creating default tenant...');

  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: config.defaultTenant.slug },
  });

  if (existingTenant) {
    console.log(`  Default tenant already exists: ${existingTenant.name}`);
    return existingTenant;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: config.defaultTenant.name,
      slug: config.defaultTenant.slug,
      status: 'active',
    },
  });

  console.log(`  Created tenant: ${tenant.name}`);

  // Create free subscription for default tenant
  const freePlan = plans.find((p) => p.code === 'free');
  if (freePlan) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: freePlan.id,
        billingCycle: 'monthly',
        status: 'active',
        startDate: new Date(),
      },
    });
    console.log(`  Created free subscription for default tenant`);
  }

  return tenant;
}

async function migrateExistingData(tenantId: string) {
  console.log('Migrating existing data to default tenant...');

  // Update companies
  const companiesResult = await prisma.company.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  });
  console.log(`  Updated ${companiesResult.count} companies`);

  // Update device assignments
  const devicesResult = await prisma.deviceAssignment.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  });
  console.log(`  Updated ${devicesResult.count} device assignments`);

  // Update asset assignments
  const assetsResult = await prisma.assetAssignment.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  });
  console.log(`  Updated ${assetsResult.count} asset assignments`);

  // Update chat sessions
  const chatResult = await prisma.chatSession.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  });
  console.log(`  Updated ${chatResult.count} chat sessions`);

  // Update alert rules
  const alertsResult = await prisma.alertRule.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  });
  console.log(`  Updated ${alertsResult.count} alert rules`);
}

async function createTenantAdmin(tenantId: string) {
  console.log('Creating Tenant Admin user...');

  const email = 'tenant-admin@default.local';

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`  Tenant Admin already exists: ${email}`);
    return existing;
  }

  const passwordHash = await bcrypt.hash('TenantAdmin123!', SALT_ROUNDS);

  const tenantAdmin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Tenant',
      lastName: 'Admin',
      role: 'tenant_admin',
      status: 'active',
      emailVerified: true,
      tenantId,
    },
  });

  console.log(`  Created Tenant Admin: ${tenantAdmin.email}`);
  console.log(`  Password: TenantAdmin123! (CHANGE THIS!)`);

  return tenantAdmin;
}

async function main() {
  console.log('='.repeat(60));
  console.log('IoT CRM Multi-Tenancy Migration');
  console.log('='.repeat(60));
  console.log();

  try {
    // 1. Create subscription plans
    const plans = await createPlans();
    console.log();

    // 2. Create SysAdmin user
    await createSysAdmin();
    console.log();

    // 3. Create default tenant with free subscription
    const tenant = await createDefaultTenant(plans);
    console.log();

    // 4. Migrate existing data
    await migrateExistingData(tenant.id);
    console.log();

    // 5. Create tenant admin for the default tenant
    await createTenantAdmin(tenant.id);
    console.log();

    console.log('='.repeat(60));
    console.log('Migration completed successfully!');
    console.log('='.repeat(60));
    console.log();
    console.log('Next steps:');
    console.log('1. Change the default passwords');
    console.log(`2. Configure environment variables (JWT_SECRET, STRIPE keys, etc.)`);
    console.log('3. Run the server: pnpm dev');
    console.log('4. Access API docs: http://localhost:5001/docs');
    console.log();

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
