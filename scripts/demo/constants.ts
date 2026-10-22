// Identificadores fijos de la Empresa Demo (spec 93). El borrado (`removeDemo.ts`) solo actúa
// cuando coinciden el nombre de la empresa y el correo del usuario demo: ver docs/sucursal-demo.md.
export const DEMO_COMPANY_NAME = "Empresa Demo";
export const DEMO_BRANCH_NAME = "Sucursal Demo";
export const DEMO_USER_EMAIL = "demo@centropodologico.test";
export const DEMO_USER_NAME = "Usuario Demo";
export const DEMO_USER_ROLE_ID = 1;

// Catálogos reutilizados de la empresa real (RH.departamentos, RH.puestos, RH.turnos y
// RH.payment_periods son catálogos compartidos, no filas de la Empresa Demo: la semilla solo
// los lee, nunca los borra).
export const DEMO_PAYMENT_PERIOD_ID_WEEKLY = 1;
export const DEMO_SHIFT_ID_MORNING = 1;

type DemoEmployeeRole = "podologist" | "receptionist" | "branchManager" | "assistant" | "director";

type DemoScenario =
  | "overtime" // checadas con salida tarde, autorizadas en la preparación
  | "absences" // faltas sin justificar
  | "lateness" // retardos leves y graves
  | "shiftExtension" // asignación del bono de extensión de jornada
  | "incompletePunch" // un día con entrada y sin salida
  | "counterSales"; // ventas de mostrador

export interface IDemoEmployeeFixture {
  key: string; // estable entre corridas, nunca cambia
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  genero: "masculino" | "femenino";
  role: DemoEmployeeRole;
  hireDate: "yearStart" | "midYear"; // midYear: 1 de julio del año en curso
  idDepartment: number;
  idPuesto: number;
  dailySalary: number; // salario_diario
  dailyFiscalSalary: number; // salario_diario_fiscal
  sbc: number;
  ptuCategory: "N" | "C" | "X";
  linkedUserRoleId: 2 | null; // solo los podólogos
  scenarios: readonly DemoScenario[];
  // Fiscales: formato validado por los CHECK de RH.empleados, no corresponden a nadie real.
  rfc: string;
  curp: string;
  nss: string;
  fechaNacimiento: string; // "YYYY-MM-DD", consistente con los 6 dígitos de la CURP
}

/**
 * 7 empleados fijos de la Empresa Demo: 3 podólogos (vinculados a un usuario rol 2), una
 * recepcionista, un gerente de recepción (tope de confianza en PTU), una auxiliar de podología
 * (ingreso a mitad de año, aguinaldo proporcional) y un socio-director (excluido del reparto de PTU).
 */
export const DEMO_EMPLOYEES: readonly IDemoEmployeeFixture[] = [
  {
    key: "podologo-1",
    firstName: "Diego",
    lastNamePaterno: "Domínguez",
    lastNameMaterno: "García",
    genero: "masculino",
    role: "podologist",
    hireDate: "yearStart",
    idDepartment: 1, // Podología
    idPuesto: 1, // Podólogo
    dailySalary: 450,
    dailyFiscalSalary: 350,
    sbc: 400,
    ptuCategory: "N",
    linkedUserRoleId: 2,
    scenarios: ["overtime", "incompletePunch"],
    rfc: "DOGA850315TX2",
    curp: "DOGA850315HVZDGL02",
    nss: "12345678901",
    fechaNacimiento: "1985-03-15",
  },
  {
    key: "podologo-2",
    firstName: "Mariana",
    lastNamePaterno: "López",
    lastNameMaterno: "Ortiz",
    genero: "femenino",
    role: "podologist",
    hireDate: "yearStart",
    idDepartment: 1,
    idPuesto: 1,
    dailySalary: 450,
    dailyFiscalSalary: 350,
    sbc: 400,
    ptuCategory: "N",
    linkedUserRoleId: 2,
    scenarios: ["lateness"],
    rfc: "LOOM880622QY4",
    curp: "LOOM880622MVZRTN05",
    nss: "23456789012",
    fechaNacimiento: "1988-06-22",
  },
  {
    key: "podologo-3",
    firstName: "Carlos",
    lastNamePaterno: "Pérez",
    lastNameMaterno: "Nava",
    genero: "masculino",
    role: "podologist",
    hireDate: "yearStart",
    idDepartment: 1,
    idPuesto: 1,
    dailySalary: 450,
    dailyFiscalSalary: 350,
    sbc: 400,
    ptuCategory: "N",
    linkedUserRoleId: 2,
    scenarios: ["absences"],
    rfc: "PENC900110AB5",
    curp: "PENC900110HVZRBL03",
    nss: "34567890123",
    fechaNacimiento: "1990-01-10",
  },
  {
    key: "recepcionista-1",
    firstName: "Ana",
    lastNamePaterno: "Ruiz",
    lastNameMaterno: "Flores",
    genero: "femenino",
    role: "receptionist",
    hireDate: "yearStart",
    idDepartment: 3, // Recepción
    idPuesto: 6, // Supervisor de recepción
    dailySalary: 320,
    dailyFiscalSalary: 300,
    sbc: 310,
    ptuCategory: "N",
    linkedUserRoleId: null,
    scenarios: ["counterSales"],
    rfc: "RUFA950228ZC6",
    curp: "RUFA950228MVZZLN08",
    nss: "45678901234",
    fechaNacimiento: "1995-02-28",
  },
  {
    key: "gerente-recepcion",
    firstName: "Gustavo",
    lastNamePaterno: "Torres",
    lastNameMaterno: "Gómez",
    genero: "masculino",
    role: "branchManager",
    hireDate: "yearStart",
    idDepartment: 3,
    idPuesto: 5, // Gerente de recepción
    dailySalary: 600,
    dailyFiscalSalary: 500,
    sbc: 520,
    ptuCategory: "C", // tope de confianza
    linkedUserRoleId: null,
    scenarios: ["shiftExtension"],
    rfc: "TOGU800705DX7",
    curp: "TOGU800705HVZRRS01",
    nss: "56789012345",
    fechaNacimiento: "1980-07-05",
  },
  {
    key: "auxiliar-podologia",
    firstName: "Jimena",
    lastNamePaterno: "Fernández",
    lastNameMaterno: "Ruiz",
    genero: "femenino",
    role: "assistant",
    hireDate: "midYear",
    idDepartment: 1,
    idPuesto: 2, // Auxiliar de podología
    dailySalary: 300,
    dailyFiscalSalary: 280,
    sbc: 290,
    ptuCategory: "N",
    linkedUserRoleId: null,
    scenarios: [],
    rfc: "FERJ990815EY8",
    curp: "FERJ990815MVZRRM07",
    nss: "67890123456",
    fechaNacimiento: "1999-08-15",
  },
  {
    key: "director",
    firstName: "Héctor",
    lastNamePaterno: "Orozco",
    lastNameMaterno: "Ramírez",
    genero: "masculino",
    role: "director",
    hireDate: "yearStart",
    idDepartment: 7, // Socios
    idPuesto: 12, // Socio
    dailySalary: 1000,
    dailyFiscalSalary: 800,
    sbc: 850,
    ptuCategory: "X", // excluido del reparto de PTU
    linkedUserRoleId: null,
    scenarios: [],
    rfc: "OARH750401FZ9",
    curp: "OARH750401HVZRMC05",
    nss: "78901234567",
    fechaNacimiento: "1975-04-01",
  },
];
