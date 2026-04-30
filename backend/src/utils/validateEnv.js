/**
 * Environment Variable Validation
 * Run this at startup to ensure all required env vars are present
 */

const requiredEnvVars = {
  development: [
    { name: 'JWT_SECRET', minLength: 16, required: true },
    { name: 'DB_PASSWORD', required: true },
    { name: 'DB_HOST', default: 'localhost' },
    { name: 'DB_PORT', default: '5432' },
    { name: 'DB_USER', default: 'postgres' },
    { name: 'DB_NAME', default: 'pusdatin_nu' },
    { name: 'PORT', default: '7860' }
  ],
  production: [
    { name: 'JWT_SECRET', minLength: 32, required: true },
    { name: 'DB_PASSWORD', required: true },
    { name: 'DB_HOST', required: true },
    { name: 'DB_PORT', default: '5432' },
    { name: 'DB_USER', required: true },
    { name: 'DB_NAME', required: true },
    { name: 'PORT', default: '7860' },
    { name: 'ALLOWED_ORIGINS', required: true },
    { name: 'GOOGLE_API_KEY', required: false }
  ]
};

const validateEnv = (env = process.env.NODE_ENV || 'development') => {
  const vars = requiredEnvVars[env] || requiredEnvVars.development;
  const missing = [];
  const warnings = [];

  console.log(`\n🔍 VALIDATING ENVIRONMENT (${env.toUpperCase()})`);
  console.log('='.repeat(50));

  for (const v of vars) {
    const value = process.env[v.name];
    
    if (v.required && !value) {
      missing.push(v.name);
      console.error(`❌ Missing required: ${v.name}`);
      continue;
    }

    if (value && v.minLength && value.length < v.minLength) {
      warnings.push(`${v.name} (too short, min ${v.minLength} chars)`);
      console.warn(`⚠️  ${v.name} is too short (${value.length} < ${v.minLength})`);
      continue;
    }

    if (value) {
      console.log(`✅ ${v.name}: ${v.name.includes('SECRET') || v.name.includes('PASSWORD') ? '***' : value}`);
    } else if (v.default) {
      process.env[v.name] = v.default;
      console.log(`ℹ️  ${v.name}: using default '${v.default}'`);
    }
  }

  console.log('='.repeat(50));

  if (missing.length > 0) {
    console.error(`\n❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
    if (env === 'production') {
      process.exit(1);
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n⚠️  WARNINGS: ${warnings.join(', ')}`);
  }

  if (missing.length === 0) {
    console.log('\n✅ Environment validation passed!\n');
  }

  return { missing, warnings };
};

module.exports = validateEnv;
