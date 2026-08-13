
import sql,{config} from"mssql";

/** Cliente con la misma firma que DB.queryParams, pero atado a una transacción. */
export interface ITransactionClient {
  queryParams(consult: string, params: Record<string, unknown>): Promise<any[]>;
}

const dbSettings:config = {
  server: process.env.DB_HOST!,
  database: process.env.DB_NAME!,
  authentication:{
    type:'default',
    options:{
      userName:process.env.DB_USERNAME!,
      password: process.env.DB_PASSWORD!
    }
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    cryptoCredentialsDetails:{
      minVersion: 'TLSv1',
      
    },
    encrypt: false, // for azure
    trustServerCertificate: true, // change to true for local dev / self-signed certs
    
  },
  
};


class DB { 
  private dbSettings
  constructor(dbSettings:config) {
    this.dbSettings = dbSettings;
  }

  async query(consult:string) {
    const pool = await sql.connect(this.dbSettings);
    const result = await pool.request().query(consult);
    // pool.close()
    return result.recordset;
  }

  /**
   * Enlaza los parámetros al request, mapeando cada valor JS a su tipo SQL.
   * Los números sin parte decimal se mandan como Int (compatibilidad con IDs
   * existentes); los números con decimales se mandan como Decimal(18,6) para
   * no truncar cantidades ni precios (ver spec 09, "Mejora de la lógica de split").
   */
  private bindParams(request: sql.Request, params: Record<string, unknown>) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'boolean') {
        request.input(key, sql.Bit, value);
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          request.input(key, sql.Int, value);
        } else {
          request.input(key, sql.Decimal(18, 6), value);
        }
      } else if (value instanceof Date) {
        request.input(key, sql.DateTime2, value);
      } else {
        request.input(key, sql.NVarChar(sql.MAX), value ?? null);
      }
    }
  }

  async queryParams(consult: string, params: Record<string, unknown>) {
    const pool = await sql.connect(this.dbSettings);
    const request = pool.request();
    this.bindParams(request, params);
    const result = await request.query(consult);
    return result.recordset;
  }

  /**
   * Ejecuta `work` dentro de una transacción SQL Server: commit si `work` resuelve,
   * rollback si lanza. `work` recibe un cliente con la misma firma `queryParams`,
   * atado a la transacción, para que el resto del código no tenga que distinguir
   * entre ejecutar con o sin transacción.
   */
  async transaction<T>(work: (tx: ITransactionClient) => Promise<T>): Promise<T> {
    const pool = await sql.connect(this.dbSettings);
    const dbTransaction = new sql.Transaction(pool);
    await dbTransaction.begin();

    const client: ITransactionClient = {
      queryParams: async (consult: string, params: Record<string, unknown>) => {
        const request = new sql.Request(dbTransaction);
        this.bindParams(request, params);
        const result = await request.query(consult);
        return result.recordset;
      },
    };

    try {
      const result = await work(client);
      await dbTransaction.commit();
      return result;
    } catch (error) {
      await dbTransaction.rollback();
      throw error;
    }
  }
}

const db = new DB(dbSettings);


export default db