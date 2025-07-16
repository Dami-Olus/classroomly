const { PrismaClient } = require('@prisma/client');

/**
 * @type {import('@prisma/client').PrismaClient}
 */
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

module.exports = prisma; 