export interface IUnitMeasurement {
  id_unit_measurement: number;
  id_type:              number | null;
  name:                 string;
  code:                 string;
  value:                number;
  status:               boolean;
}
