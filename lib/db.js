import mysql from 'mysql2/promise';

export function getPool() {
  if (!globalThis.__mysqlPool) {
    const useSsl = process.env.DB_SSL === 'true';
    const ca = process.env.DB_SSL_CA?.replace(/\\n/g, '\n');

    globalThis.__mysqlPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      dateStrings: true,
      ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca } : {}) } : undefined,
    });
  }
  return globalThis.__mysqlPool;
}
