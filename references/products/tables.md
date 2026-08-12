
```sql
CREATE TABLE [inventory].[Products](
	[id_product] [int] NOT NULL,
	[name] [varchar](100) NULL,
	[id_category] [smallint] NULL,
	[brand] [varchar](100) NULL,
	[presentation] [varchar](100) NULL,
	[id_unit_measurement] [smallint] NULL,
	[size] [varchar](50) NULL,
	[price] [decimal](18, 6) NULL,
	[product_code] [varchar](100) NULL,
	[id_supplier] [int] NULL,
	[pieces] [int] NULL,
	[id_empresa] [int] NULL,
	[description] [varchar](250) NULL,
	[created_at] [datetime] NULL,
	[activo] [bit] NULL,
	[status] [bit] NULL,
	[split] [bit] NULL,
    [url_product] [varchar](250) NULL
)
```

```sql
CREATE TABLE [inventory].[units_measurement](
	[id_unit_measurement] [int] NOT NULL,
	[id_type] [int] NULL,
	[name] [nvarchar](50) NULL,
	[code] [varchar](10) NULL,
	[value] [decimal](18, 4) NULL,
	[status] [bit] NULL)
```

```sql
CREATE TABLE [inventory].[categories](
	[id_category] [smallint] NOT NULL,
	[name] [varchar](50) NULL,
	[status] [bit] NULL,
	[activo] [bit] NULL,
	[id_empresa] [int] NULL)
```
```sql
CREATE TABLE [CentroPodologico].[inventory].[proveedores] (
  [id_proveedor]               INT             NOT NULL PRIMARY KEY, -- MAX(id_proveedor)+1 en el INSERT, no identity
  [id_empresa]                 INT             NOT NULL,
  [nombre_corto]                NVARCHAR(255)   NOT NULL,
  [nombre_legal]                NVARCHAR(255)   NULL,
  [rfc]                         NVARCHAR(20)    NULL,
  [codigo_postal]               NVARCHAR(10)    NULL,
  [direccion]                   NVARCHAR(500)   NULL,
  [web]                         NVARCHAR(255)   NULL,
  [telefono_principal]          NVARCHAR(20)    NULL,
  [id_phonecode_principal]      INT             NULL,
  [telefono_secundario]         NVARCHAR(20)    NULL,
  [whatsapp_principal]          NVARCHAR(20)    NULL,
  [id_whatsappcode_principal]   INT             NULL,
  [whatsapp_secundario]         NVARCHAR(20)    NULL,
  [email_principal]             NVARCHAR(255)   NULL,
  [email_secundario]            NVARCHAR(255)   NULL,
  [activo]                      BIT             NOT NULL DEFAULT 1,
  [status]                      BIT             NOT NULL DEFAULT 1,
  [created_at]                  DATETIME        NOT NULL
);
```

