// Types minimaux de sql.js (le moteur SQLite de jeep-sqlite), utilisé seulement par les tests.
declare module "sql.js" {
  interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }
  interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string, params?: unknown[]): QueryExecResult[];
  }
  interface SqlJsStatic {
    Database: new () => Database;
  }
  export default function initSqlJs(): Promise<SqlJsStatic>;
}
