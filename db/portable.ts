/**
 * Small compatibility layer for the SQL subset used by the forum services.
 * The forum service uses this small adapter so the same domain queries work
 * with local SQLite, PostgreSQL, or MySQL.
 */
export type SqlDriver = 'sqlite' | 'postgres' | 'mysql';

export type QueryResult = { results: Record<string, unknown>[]; meta: { changes: number } };

export interface PreparedStatement {
  bind(...values: unknown[]): PreparedStatement;
  all<T extends Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T extends Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<QueryResult>;
}

export interface PortableDatabase {
  prepare(query: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<QueryResult[]>;
}

type SqliteDatabase = import('node:sqlite').DatabaseSync;
type SqliteStatement = import('node:sqlite').StatementSync;

class SqliteNodeStatement implements PreparedStatement {
  private values: unknown[] = [];
  private readonly statement: SqliteStatement;
  constructor(statement: SqliteStatement) { this.statement = statement; }
  bind(...values: unknown[]): PreparedStatement {
    this.values = values;
    return this;
  }
  async all<T extends Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...this.values as never[]) as T[] };
  }
  async first<T extends Record<string, unknown>>(): Promise<T | null> {
    return (this.statement.get(...this.values as never[]) as T | undefined) ?? null;
  }
  async run(): Promise<QueryResult> {
    const result = this.statement.run(...this.values as never[]);
    return { results: [], meta: { changes: Number(result.changes ?? 0) } };
  }
}

export class SqliteNodeAdapter implements PortableDatabase {
  private readonly db: SqliteDatabase;
  constructor(db: SqliteDatabase) { this.db = db; }
  prepare(query: string): PreparedStatement {
    return new SqliteNodeStatement(this.db.prepare(query));
  }
  async batch(statements: PreparedStatement[]): Promise<QueryResult[]> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const results: QueryResult[] = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

type PostgresClient = ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>) & {
  unsafe(query: string, values?: unknown[]): Promise<Record<string, unknown>[]>;
  end(): Promise<void>;
};
type MysqlConnection = {
  execute(query: string, values?: unknown[]): Promise<[Record<string, unknown>[], unknown]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  end(): Promise<void>;
};

function dynamicImport(specifier: string): Promise<unknown> {
  return import(specifier);
}

function postgresPlaceholders(query: string): string {
  let index = 0;
  return query.replaceAll('?', () => `$${++index}`);
}

/**
 * The forum service intentionally uses SQLite-compatible SQL. Keep that API
 * portable for the PostgreSQL/MySQL adapters by translating
 * the handful of SQLite-only write forms at the adapter boundary.
 */
export function normalizeNodeSql(query: string, driver: Exclude<SqlDriver, 'sqlite'>): string {
  let normalized = query;

  // SQLite's scalar MAX(a, b) is called GREATEST(a, b) by PostgreSQL/MySQL.
  normalized = normalized.replace(/\bMAX\(0,\s*/g, 'GREATEST(0, ');
  normalized = normalized.replace(/\bMAX\(browsing_history\.max_read_floor,\s*excluded\.max_read_floor\)/g, 'GREATEST(browsing_history.max_read_floor, excluded.max_read_floor)');

  if (driver === 'postgres') {
    // PostgreSQL supports ON CONFLICT, but not SQLite's INSERT OR IGNORE.
    if (/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(normalized)) {
      normalized = normalized.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');
      normalized = `${normalized.trimEnd()} ON CONFLICT DO NOTHING`;
    }
    return normalized;
  }

  // MySQL uses INSERT IGNORE and ON DUPLICATE KEY UPDATE for the equivalent
  // operations. These are the two upserts used by the service layer.
  normalized = normalized.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT IGNORE INTO');
  normalized = normalized.replace(
    /ON\s+CONFLICT\(user_id,\s*target_type,\s*target_id\)\s*DO\s+UPDATE\s+SET\s+value\s*=\s*excluded\.value,\s*updated_at\s*=\s*excluded\.updated_at/gi,
    'ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)',
  );
  normalized = normalized.replace(
    /ON\s+CONFLICT\(user_id,\s*post_id\)\s*DO\s+UPDATE\s+SET\s*max_read_floor\s*=\s*(?:MAX|GREATEST)\(browsing_history\.max_read_floor,\s*excluded\.max_read_floor\),\s*anchor_reply_id\s*=\s*excluded\.anchor_reply_id,\s*last_viewed_at\s*=\s*excluded\.last_viewed_at/gi,
    'ON DUPLICATE KEY UPDATE max_read_floor = GREATEST(max_read_floor, VALUES(max_read_floor)), anchor_reply_id = VALUES(anchor_reply_id), last_viewed_at = VALUES(last_viewed_at)',
  );
  return normalized;
}

class NodeStatement implements PreparedStatement {
  private values: unknown[] = [];
  private readonly db: NodeAdapter;
  private readonly query: string;
  constructor(db: NodeAdapter, query: string) { this.db = db; this.query = query; }
  bind(...values: unknown[]): PreparedStatement { this.values = values; return this; }
  async all<T extends Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: (await this.db.execute(this.query, this.values)).rows as T[] };
  }
  async first<T extends Record<string, unknown>>(): Promise<T | null> {
    const rows = (await this.db.execute(this.query, this.values)).rows as T[];
    return rows[0] ?? null;
  }
  async run(): Promise<QueryResult> {
    const result = await this.db.execute(this.query, this.values);
    return { results: [], meta: { changes: result.changes } };
  }
}

export class NodeAdapter implements PortableDatabase {
  private readonly client: Promise<PostgresClient | MysqlConnection>;
  private readonly driver: Exclude<SqlDriver, 'sqlite'>;
  constructor(driver: Exclude<SqlDriver, 'sqlite'>, url: string) {
    this.driver = driver;
    this.client = driver === 'postgres'
      ? dynamicImport('postgres').then((mod) => {
          const factory = (mod as { default: (connection: string) => PostgresClient }).default;
          return factory(url);
        })
      : dynamicImport('mysql2/promise').then((mod) => {
          const factory = (mod as { createConnection: (connection: string) => Promise<MysqlConnection> }).createConnection;
          return factory(url);
        });
  }
  prepare(query: string): PreparedStatement { return new NodeStatement(this, query); }
  async execute(query: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[]; changes: number }> {
    const client = await this.client;
    const sql = normalizeNodeSql(query, this.driver);
    if (this.driver === 'postgres') {
      const rows = await (client as PostgresClient).unsafe(postgresPlaceholders(sql), values);
      const count = typeof rows === 'object' && rows !== null && 'count' in rows ? Number((rows as unknown as { count?: number }).count ?? 0) : rows.length;
      return { rows, changes: count };
    }
    const [rows, result] = await (client as MysqlConnection).execute(sql, values);
    const records = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
    const changes = typeof result === 'object' && result !== null && 'affectedRows' in result
      ? Number((result as { affectedRows?: number }).affectedRows ?? 0)
      : records.length;
    return { rows: records, changes };
  }
  async batch(statements: PreparedStatement[]): Promise<QueryResult[]> {
    const client = await this.client;
    const results: QueryResult[] = [];
    if (this.driver === 'mysql') await (client as MysqlConnection).beginTransaction();
    if (this.driver === 'postgres') await (client as PostgresClient).unsafe('BEGIN');
    try {
      for (const statement of statements) results.push(await statement.run());
      if (this.driver === 'mysql') await (client as MysqlConnection).commit();
      if (this.driver === 'postgres') await (client as PostgresClient).unsafe('COMMIT');
      return results;
    } catch (error) {
      if (this.driver === 'mysql') await (client as MysqlConnection).rollback();
      if (this.driver === 'postgres') await (client as PostgresClient).unsafe('ROLLBACK');
      throw error;
    }
  }
}

export function createPortableDatabase(driver: Exclude<SqlDriver, 'sqlite'>, url?: string): PortableDatabase {
  if (!url) throw new Error('DATABASE_URL is required for PostgreSQL/MySQL');
  return new NodeAdapter(driver, url);
}
