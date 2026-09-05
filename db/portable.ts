/**
 * Small compatibility layer for the SQL subset used by the forum services.
 * D1 remains the default on Workers; Node deployments can select postgres or
 * mysql2 with DATABASE_DRIVER/DATABASE_URL without changing domain queries.
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

type D1Like = {
  prepare(query: string): D1LikeStatement;
  batch(statements: D1LikeStatement[]): Promise<QueryResult[]>;
};
type D1LikeStatement = PreparedStatement;

class D1Adapter implements PortableDatabase {
  constructor(private readonly db: D1Like) {}
  prepare(query: string): PreparedStatement { return this.db.prepare(query); }
  batch(statements: PreparedStatement[]): Promise<QueryResult[]> { return this.db.batch(statements as D1LikeStatement[]); }
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

class NodeStatement implements PreparedStatement {
  private values: unknown[] = [];
  constructor(private readonly db: NodeAdapter, private readonly query: string) {}
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
  constructor(private readonly driver: Exclude<SqlDriver, 'sqlite'>, url: string) {
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
    if (this.driver === 'postgres') {
      const rows = await (client as PostgresClient).unsafe(postgresPlaceholders(query), values);
      const count = typeof rows === 'object' && rows !== null && 'count' in rows ? Number((rows as unknown as { count?: number }).count ?? 0) : rows.length;
      return { rows, changes: count };
    }
    const [rows, result] = await (client as MysqlConnection).execute(query, values);
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

export function createPortableDatabase(envDb: D1Like | undefined, driver: SqlDriver, url?: string): PortableDatabase {
  if (driver === 'sqlite' || envDb) {
    if (!envDb) throw new Error('DATABASE_URL is required when DATABASE_DRIVER is sqlite outside Workers');
    return new D1Adapter(envDb);
  }
  if (!url) throw new Error('DATABASE_URL is required for PostgreSQL/MySQL');
  return new NodeAdapter(driver, url);
}
